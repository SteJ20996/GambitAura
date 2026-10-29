// Retrograde solver for 光路 Guanglu (GambitAura Game 03).
// Board: R x C cells, every cell a two-sided mirror, '/' (bit 0) or '\' (bit 1); cell = row*C+col.
// Each side has a light source on the rim (a port) and a target port. A beam enters at its source,
// turns 90 degrees in every cell and leaves at some port. Ports: top 0..C-1, right C..C+R-1,
// bottom C+R..2C+R-1, left 2C+R..2C+2R-1. Coral's ports are Mint's turned half way round.
// A turn flips one mirror; --mv says which: 0 any mirror, 1 one the mover's beam passes, 2 one that
// either beam passes (the shipped rule). With --ban 1 (shipped) the mirror the other side just
// flipped cannot be flipped straight back. A side with no move passes. After a move: if the mover's
// beam reaches its target the mover wins; else if only the other beam does, the other side wins.
// State = (config, last flipped cell, side to move): 2^20 x 21 x 2 = 44,040,192 states on 4 x 5.
//
// Defaults are the shipped game: --rc 4 5 --mv 2 --ban 1, Mint B2 -> L3 (ports 11 -> 17).
// Build: gcc -O3 -march=native -fopenmp -o solver solver.c
// Use:   ./solver --design 11 17 --start 3840               value of the start and of every first move
//        ./solver --design 11 17 --start 3840 --perft 6     move-tree counts; must match engine.js
//        ./solver --design 11 17 --start 3840 --dump table.bin   table for check_table.mjs, probe_ai.mjs
//        ./solver --design 11 17 --minmoves 5 --top 3       rank half-turn symmetric draw starts
//        ./solver --scan                                     every port design (about 7 s each)
//        ./solver --rc 4 4 --mv 0 --scan                     the first draft on 4 x 4
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <omp.h>

static int R = 4, C = 5, NC, BAN = 1, L, MV = 2;   // MV 0 any mirror, 1 own beam's mirrors, 2 either beam's
static uint32_t *path;   // path[cfg*2+side]: cells the side's beam passes through
static long NCFG, NST;
static uint16_t *val;
static uint8_t *hit;
static int msrc, mtgt, csrc, ctgt;
static const int DR[4] = {-1, 0, 1, 0}, DC[4] = {0, 1, 0, -1};          // N E S W
static const int REFL[2][4] = {{1, 0, 3, 2}, {3, 2, 1, 0}};             // '/', '\'
static int NP;   // ports: top 0..C-1, right C..C+R-1, bottom .., left ..

static int rotPort(int p) {
  if (p < C) return C + R + (C - 1 - p);
  if (p < C + R) return 2 * C + R + (R - 1 - (p - C));
  if (p < 2 * C + R) return C - 1 - (p - C - R);
  return C + (R - 1 - (p - 2 * C - R));
}
static void portName(int p, char *b) {
  if (p < C) sprintf(b, "T%d", p);
  else if (p < C + R) sprintf(b, "R%d", p - C);
  else if (p < 2 * C + R) sprintf(b, "B%d", p - C - R);
  else sprintf(b, "L%d", p - 2 * C - R);
}
static int trace2(uint32_t cfg, int port, uint32_t *cells) {
  int r, c, d;
  if (cells) *cells = 0;
  if (port < C) { r = 0; c = port; d = 2; }
  else if (port < C + R) { r = port - C; c = C - 1; d = 3; }
  else if (port < 2 * C + R) { r = R - 1; c = port - C - R; d = 0; }
  else { r = port - 2 * C - R; c = 0; d = 1; }
  for (int steps = 0; steps < 4 * NC + 4; steps++) {
    if (cells) *cells |= 1u << (r * C + c);
    d = REFL[(cfg >> (r * C + c)) & 1][d];
    r += DR[d]; c += DC[d];
    if (r < 0) return c;
    if (c >= C) return C + r;
    if (r >= R) return C + R + c;
    if (c < 0) return 2 * C + R + r;
  }
  return -1;   // cannot happen: a beam from the edge never loops
}
static void prepare(void) {
  NC = R * C; NCFG = 1L << NC; L = BAN ? NC + 1 : 1; NST = NCFG * L * 2; NP = 2 * (R + C);
  hit = malloc(NCFG);
  path = malloc(NCFG * 2 * sizeof(uint32_t));
#pragma omp parallel for
  for (long g = 0; g < NCFG; g++) {
    uint32_t a, b;
    hit[g] = (trace2(g, msrc, &a) == mtgt ? 1 : 0) | (trace2(g, csrc, &b) == ctgt ? 2 : 0);
    path[g * 2] = a; path[g * 2 + 1] = b;
  }
}
static inline long sidx(long cfg, int last, int side) { return ((cfg * L) + last) * 2 + side; }
static inline uint32_t moveMask(long cfg, int last, int side) {
  uint32_t m = MV == 0 ? (uint32_t)((1L << NC) - 1) : MV == 1 ? path[cfg * 2 + side] : (path[cfg * 2] | path[cfg * 2 + 1]);
  if (BAN && last < NC) m &= ~(1u << last);
  return m;
}
// successors; a side with no move passes (the ban lapses)
static inline int succs(long cfg, int last, int side, long *out) {
  uint32_t m = moveMask(cfg, last, side); int n = 0;
  for (uint32_t x = m; x; x &= x - 1) { int k = __builtin_ctz(x); out[n++] = sidx(cfg ^ (1L << k), BAN ? k : 0, 1 - side); }
  if (!n) out[n++] = sidx(cfg, BAN ? NC : 0, 1 - side);
  return n;
}

static int longest;
static void solve(void) {
  val = calloc(NST, 2);
#pragma omp parallel for
  for (long i = 0; i < NST; i++) {
    int side = i & 1; long cfg = i / 2 / L;
    int me = side ? 2 : 1, other = side ? 1 : 2;
    if (hit[cfg] & other) val[i] = 1; else if (hit[cfg] & me) val[i] = 2;
  }
  int idle = 0; longest = 0;
  for (int p = 1; idle < 2; p++) {
    long changed = 0; const int odd = p & 1; const uint16_t lim = 2 * p;
#pragma omp parallel for reduction(+:changed) schedule(dynamic, 65536)
    for (long i = 0; i < NST; i++) {
      if (val[i]) continue;
      int side = i & 1; long rest = i / 2; int last = rest % L; long cfg = rest / L;
      long su[32]; int n = succs(cfg, last, side, su);
      if (odd) {
        for (int j = 0; j < n; j++) {
          uint16_t v = val[su[j]];
          if (v && (v & 1) && v <= lim) { val[i] = 2 * p + 2; changed++; break; }
        }
      } else {
        int all = 1;
        for (int j = 0; j < n && all; j++) {
          uint16_t v = val[su[j]];
          if (!(v && !(v & 1) && v <= lim)) all = 0;
        }
        if (all) { val[i] = 2 * p + 1; changed++; }
      }
    }
    if (changed) { idle = 0; longest = p; } else idle++;
  }
}
static int plies(uint16_t v) { return v ? (v - 1) / 2 : -1; }
static int none(void) { return BAN ? NC : 0; }

static uint32_t rot180(uint32_t g) { uint32_t o = 0; for (int i = 0; i < NC; i++) if (g >> i & 1) o |= 1u << (NC - 1 - i); return o; }

// --- simulations ---
static uint64_t rng = 88172645463325252ull;
static inline uint64_t xr(void) { rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17; return rng; }
static int score(uint16_t w) { if (!w) return 0; return (w & 1) ? 1000 - plies(w) : -1000 + plies(w); }
static int movesOf(long cfg, int last, int side, long *succ) { return succs(cfg, last, side, succ); }
static void sim(long cfg0, int games, double eps, double *out) {
  int wins[3] = {0, 0, 0}; long len = 0;
  for (int g = 0; g < games; g++) {
    long s = sidx(cfg0, none(), 0); int ply = 0, result = 2;
    while (ply < 300) {
      uint16_t v = val[s]; int side = s & 1;
      if (v == 1) { result = 1 - side; break; }
      if (v == 2) { result = side; break; }
      long su[32]; int n = movesOf(s / 2 / L, (s / 2) % L, side, su), pick = 0;
      if ((xr() % 10000) < eps * 10000) pick = xr() % n;
      else { int best = -100000, cnt = 0; for (int j = 0; j < n; j++) { int sc = score(val[su[j]]); if (sc > best) { best = sc; cnt = 1; pick = j; } else if (sc == best && xr() % ++cnt == 0) pick = j; } }
      s = su[pick]; ply++;
    }
    wins[result]++; len += ply;
  }
  out[0] = 100.0 * wins[0] / games; out[1] = 100.0 * wins[1] / games; out[2] = 100.0 * wins[2] / games; out[3] = (double)len / games;
}
// perfect vs one-move-lookahead; returns perfect win %
static double duel(long cfg0, int games, int perfectFirst, double *len) {
  int pw = 0; long tl = 0;
  for (int g = 0; g < games; g++) {
    long s = sidx(cfg0, none(), 0); int ply = 0, result = 2;
    while (ply < 300) {
      uint16_t v = val[s]; int side = s & 1;
      if (v == 1) { result = 1 - side; break; }
      if (v == 2) { result = side; break; }
      long su[32]; int n = movesOf(s / 2 / L, (s / 2) % L, side, su), pick = 0;
      int perfect = (side == 0) == perfectFirst;
      if (perfect) { int best = -100000, cnt = 0; for (int j = 0; j < n; j++) { int sc = score(val[su[j]]); if (sc > best) { best = sc; cnt = 1; pick = j; } else if (sc == best && xr() % ++cnt == 0) pick = j; } }
      else {
        int ok[32], k = 0, win = -1;
        for (int j = 0; j < n; j++) { if (val[su[j]] == 1) win = j; else if (val[su[j]] != 2 && val[su[j]] != 4) ok[k++] = j; }
        pick = win >= 0 ? win : k ? ok[xr() % k] : (int)(xr() % n);
      }
      s = su[pick]; ply++;
    }
    if (result == (perfectFirst ? 0 : 1)) pw++;
    if (result != 2) tl += ply;
  }
  *len = (double)tl / games;
  return 100.0 * pw / games;
}

static void stats(double *w, double *l, double *d) {
  long a = 0, b = 0, c = 0;
  for (long g = 0; g < NCFG; g++) {
    uint16_t v = val[sidx(g, none(), 0)];
    if (v == 1 || v == 2) continue;
    if (!v) c++; else if (v & 1) b++; else a++;
  }
  double t = a + b + c; *w = 100 * a / t; *l = 100 * b / t; *d = 100 * c / t;
}

static long perft(long st, int d) {
  if (val[st] == 1 || val[st] == 2 || d == 0) return 1;
  long su[32]; int n = succs(st / 2 / L, (st / 2) % L, st & 1, su); long t = 0;
  for (int j = 0; j < n; j++) t += perft(su[j], d - 1);
  return t;
}
static void printCfg(long g) {
  for (int r = 0; r < R; r++) { printf("    "); for (int c = 0; c < C; c++) printf("%c", (g >> (r * C + c)) & 1 ? '\\' : '/'); printf("\n"); }
}

int main(int argc, char **argv) {
  int scan = 0, ms = -1, mt = -1, top = 5, minMoves = 0, perftD = 0; long start = -1; const char *dump = 0;
  for (int i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "--rc")) { R = atoi(argv[++i]); C = atoi(argv[++i]); }
    else if (!strcmp(argv[i], "--ban")) BAN = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--mv")) MV = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--scan")) scan = 1;
    else if (!strcmp(argv[i], "--design")) { ms = atoi(argv[++i]); mt = atoi(argv[++i]); }
    else if (!strcmp(argv[i], "--top")) top = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--minmoves")) minMoves = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--start")) start = atol(argv[++i]);
    else if (!strcmp(argv[i], "--perft")) perftD = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--dump")) dump = argv[++i];
  }
  NC = R * C; NP = 2 * (R + C);
  if (scan) {
    printf("mv %d R %d C %d ban %d: port designs (Mint src -> tgt; Coral is the half-turn)\n", MV, R, C, BAN);
    for (int s = 0; s < NP; s++) for (int t = 0; t < NP; t++) {
      if (s == t) continue;
      msrc = s; mtgt = t; csrc = rotPort(s); ctgt = rotPort(t);
      if (csrc == msrc || csrc == mtgt || ctgt == msrc || ctgt == mtgt) continue;
      prepare(); solve();
      double w, l, d; stats(&w, &l, &d);
      int dr = 0, fw = 0, fl = 0;
      for (long g = 0; g < NCFG; g++) {
        if ((uint32_t)g != rot180(g) || hit[g]) continue;
        uint16_t v = val[sidx(g, none(), 0)];
        if (!v) dr++; else if (v & 1) fl++; else fw++;
      }
      char a[8], b[8]; portName(s, a); portName(t, b);
      if (dr == 0) { free(val); free(hit); free(path); continue; }
      printf("%s->%s  win %5.1f%% loss %5.1f%% draw %5.1f%% longest %3d | symmetric starts: draw %d first-wins %d first-loses %d\n",
             a, b, w, l, d, longest, dr, fw, fl);
      fflush(stdout);
      free(val); free(hit); free(path);
    }
    return 0;
  }
  if (ms >= 0) {
    msrc = ms; mtgt = mt; csrc = rotPort(ms); ctgt = rotPort(mt);
    prepare(); solve();
    if (dump) { FILE *f = fopen(dump, "wb"); fwrite(val, 2, NST, f); fclose(f); }
    if (start >= 0) {
      long st = sidx(start, none(), 0);
      printf("start %ld: Mint to move: %s in %d\n", start, val[st] == 0 ? "draw" : (val[st] & 1) ? "loss" : "win", plies(val[st]));
      printCfg(start);
      long su[32]; int n = succs(start, none(), 0, su);
      for (int j = 0; j < n; j++) {
        long cf = su[j] / 2 / L; int k = (su[j] / 2) % L; uint16_t v = val[su[j]];
        printf("  flip r%dc%d -> Coral %s in %d\n", k / C, k % C, v == 0 ? "draw" : (v & 1) ? "loss" : "win", plies(v)); (void)cf;
      }
      for (int k = 1; k <= perftD; k++) printf("perft %d %ld\n", k, perft(st, k));
      if (perftD) return 0;
    }
    double w, l, d; stats(&w, &l, &d);
    char a[8], b[8], c2[8], e[8]; portName(msrc, a); portName(mtgt, b); portName(csrc, c2); portName(ctgt, e);
    printf("R %d C %d ban %d | Mint %s->%s, Coral %s->%s | win %.1f%% loss %.1f%% draw %.1f%% longest %d\n", R, C, BAN, a, b, c2, e, w, l, d, longest);
    // rank symmetric draw starts by sim decisiveness and first-move traps
    typedef struct { long g; int safe, n; double s1[4], s2[4], pf, ps, pl; } Row;
    Row *rows = malloc(sizeof(Row) * 1100000); int nr = 0;
    for (long g = 0; g < NCFG; g++) {
      if ((uint32_t)g != rot180(g) || hit[g]) continue;
      if (val[sidx(g, none(), 0)] != 0) continue;
      Row rw = {g, 0, 0};
      long su[32]; int n = movesOf(g, none(), 0, su); rw.n = n;
      for (int j = 0; j < n; j++) { uint16_t x = val[su[j]]; if (!x || (x & 1)) rw.safe++; }
      if (minMoves && (n < minMoves || rw.safe < 2 || rw.safe == n)) continue;
      rows[nr++] = rw;
    }
    printf("symmetric draw starts: %d\n", nr);
    // simulate the ones with the most traps first (with --minmoves: the most first moves first)
    for (int i = 0; i < nr; i++) for (int j = i + 1; j < nr; j++) {
      int better = minMoves ? (rows[j].n > rows[i].n || (rows[j].n == rows[i].n && rows[j].safe < rows[i].safe)) : rows[j].safe < rows[i].safe;
      if (better) { Row t = rows[i]; rows[i] = rows[j]; rows[j] = t; }
    }
    for (int i = 0; i < nr && i < top; i++) {
      Row *rw = &rows[i];
      sim(rw->g, 20000, 0.1, rw->s1); sim(rw->g, 20000, 0.2, rw->s2);
      double len, len2; rw->pf = duel(rw->g, 4000, 1, &len); rw->ps = duel(rw->g, 4000, 0, &len2); rw->pl = (len + len2) / 2;
      printf("start %ld: %d of %d first moves hold | 10%% slips %.1f/%.1f/%.1f len %.0f | 20%% %.1f/%.1f/%.1f | perfect beats 1-ply %.1f%% first, %.1f%% second (len %.0f)\n",
             rw->g, rw->safe, rw->n, rw->s1[0], rw->s1[1], rw->s1[2], rw->s1[3], rw->s2[0], rw->s2[1], rw->s2[2], rw->pf, rw->ps, rw->pl);
      printCfg(rw->g);
    }
  }
  return 0;
}
