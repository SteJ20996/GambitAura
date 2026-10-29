// Solver for 日影 Riying (GambitAura Game 04): a sun, two towers each, and their shade.
// Board R x C (5 x 5), cell = row*C + col, row 0 at the top (rank 5). Towers in index order:
// Mint short, Mint tall, Coral short, Coral tall (heights from --mint / --coral, default 1,2).
// A sun stands outside the board at one of 8 places (N NE E SE S SW W NW, clockwise) and moves one
// place clockwise after every move (--sun 4 uses N E S W only; --sunstep 2 moves it every 2 moves).
// A tower of height h shades the h squares behind it, away from the sun (diagonally when the sun
// is at a corner). A tower standing in shade cannot move (--own 1: any tower's shade, the shipped
// rule; 0: only the other side's). A turn: step one free tower one square up, down, left or right
// (--diag 1 adds diagonals) onto an empty square. Win: --win 1 (shipped) reach the middle of the far
// edge (Mint c5, Coral c1); 0 any square of the far row; 2 the far row with the tallest tower only.
// A side with no move: --nomove 1 (shipped) loses; 0 passes. Threefold repetition is a draw
// (positions with no forced result stay draws here).
// Values: 0 draw, 2d = side to move wins in d plies, 2d+1 = loses in d plies.
// State index: ((pos * PH + phase) * 2 + side), pos = sum cell[t] * 25^t, phase = sun place * sunstep.
//
// Build: gcc -O3 -march=native -fopenmp -o solver solver.c
// Use:   ./solver                                   the shipped rules: totals and home-row starts
//        ./solver --start a1,d1 --sunat S           the shipped opening: every first move, simulations
//        ./solver --start a1,d1 --sunat S --perft 6 move counts; must match perft() in ../engine.js
//        ./solver --dump table.bin                  the table for check_table.mjs and probe_ai.mjs
//        ./solver --top 4 --balance                 the most even of the fair home-row starts
//        ./solver --win 0 --nomove 0 --sun 4        the first draft (a race to the far row)
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <omp.h>

static int R = 5, C = 5, NC, P = 8, SUNSTEP = 1, PH, OWN = 1, DIAG = 0, WIN = 1, NOMOVE = 1;
static int T, TM, hgt[8];
static long NPOS, NS;
static uint32_t *off; static int32_t *mch;      // child state, -1 = the move wins at once
static uint16_t *val; static int longest;
static int SDR[8], SDC[8];                       // shade direction for each sun place
static const int MDR[8] = {-1, 0, 1, 0, -1, -1, 1, 1}, MDC[8] = {0, 1, 0, -1, -1, 1, -1, 1};
static const char *SUNN[8] = {"N", "NE", "E", "SE", "S", "SW", "W", "NW"};

static void decode(long pos, int *cell) { for (int t = 0; t < T; t++) { cell[t] = pos % NC; pos /= NC; } }
static long encode(const int *cell) { long p = 0; for (int t = T - 1; t >= 0; t--) p = p * NC + cell[t]; return p; }
static int validPos(long pos) { int cell[8]; decode(pos, cell); uint64_t m = 0; for (int t = 0; t < T; t++) { if (m >> cell[t] & 1) return 0; m |= 1ull << cell[t]; } return 1; }
static inline long sidx(long pos, int ph, int side) { return (pos * PH + ph) * 2 + side; }
static int sunPlace(int ph) { int s = ph / SUNSTEP; return P == 8 ? s : s * 2; }   // 0..7 compass index
static int isTarget(int side, int t, int cell) {
  int r = cell / C, c = cell % C, far = side ? R - 1 : 0;
  if (WIN == 1) return r == far && c == C / 2;
  if (WIN == 2) { int best = side ? TM : 0; for (int u = side ? TM : 0; u < (side ? T : TM); u++) if (hgt[u] > hgt[best]) best = u; return r == far && hgt[t] == hgt[best]; }
  return r == far;
}
// towers of the side to move that stand in shade
static uint32_t frozen(const int *cell, int ph, int side) {
  int s = sunPlace(ph);
  uint64_t shade[2] = {0, 0};
  for (int t = 0; t < T; t++)
    for (int k = 1; k <= hgt[t]; k++) {
      int r = cell[t] / C + SDR[s] * k, c = cell[t] % C + SDC[s] * k;
      if (r < 0 || r >= R || c < 0 || c >= C) break;
      shade[t >= TM] |= 1ull << (r * C + c);
    }
  uint64_t sh = OWN ? (shade[0] | shade[1]) : shade[1 - side];
  uint32_t f = 0;
  for (int t = side ? TM : 0; t < (side ? T : TM); t++) if (sh >> cell[t] & 1) f |= 1u << t;
  return f;
}
// moves in a fixed order (tower, then direction N E S W [NW NE SW SE]); returns the count
static int gen(long pos, int ph, int side, int32_t *out, int *mt, int *md) {
  int cell[8] = {0}; decode(pos, cell);
  int nph = (ph + 1) % PH;
  uint32_t fz = frozen(cell, ph, side);
  uint64_t occ = 0; for (int t = 0; t < T; t++) occ |= 1ull << cell[t];
  int n = 0;
  for (int t = side ? TM : 0; t < (side ? T : TM); t++) {
    if (fz >> t & 1) continue;
    for (int d = 0; d < (DIAG ? 8 : 4); d++) {
      int r = cell[t] / C + MDR[d], c = cell[t] % C + MDC[d];
      if (r < 0 || r >= R || c < 0 || c >= C) continue;
      int nc = r * C + c; if (occ >> nc & 1) continue;
      if (mt) { mt[n] = t; md[n] = nc; }
      if (isTarget(side, t, nc)) { out[n++] = -1; continue; }
      int save = cell[t]; cell[t] = nc; out[n++] = (int32_t)sidx(encode(cell), nph, 1 - side); cell[t] = save;
    }
  }
  if (!n && !NOMOVE) { if (mt) { mt[0] = -1; md[0] = -1; } out[n++] = (int32_t)sidx(pos, nph, 1 - side); }
  return n;
}
static void build(void) {
  uint32_t *cnt = calloc(NS, 4);
#pragma omp parallel for schedule(dynamic, 1024)
  for (long pos = 0; pos < NPOS; pos++) {
    if (!validPos(pos)) continue;
    int32_t tmp[64];
    for (int ph = 0; ph < PH; ph++) for (int side = 0; side < 2; side++) cnt[sidx(pos, ph, side)] = gen(pos, ph, side, tmp, 0, 0);
  }
  off = malloc(sizeof(uint32_t) * (NS + 1)); off[0] = 0;
  for (long i = 0; i < NS; i++) off[i + 1] = off[i] + cnt[i];
  mch = malloc(sizeof(int32_t) * (off[NS] + 1));
#pragma omp parallel for schedule(dynamic, 1024)
  for (long pos = 0; pos < NPOS; pos++) {
    if (!validPos(pos)) continue;
    for (int ph = 0; ph < PH; ph++) for (int side = 0; side < 2; side++) gen(pos, ph, side, mch + off[sidx(pos, ph, side)], 0, 0);
  }
  free(cnt);
}
static void solve(void) {
  val = calloc(NS, 2); longest = 0;
  for (int d = 1;; d++) {
    long c1 = 0, c2 = 0;
#pragma omp parallel for schedule(dynamic, 8192) reduction(+:c1)
    for (long i = 0; i < NS; i++) {
      if (val[i] || !validPos(i / 2 / PH)) continue;
      for (uint32_t j = off[i]; j < off[i + 1]; j++) {
        int32_t c = mch[j];
        if ((c == -1 && d == 1) || (c >= 0 && d >= 2 && val[c] == 2 * (d - 1) + 1)) { val[i] = 2 * d; c1++; break; }
      }
    }
#pragma omp parallel for schedule(dynamic, 8192) reduction(+:c2)
    for (long i = 0; i < NS; i++) {
      if (val[i] || !validPos(i / 2 / PH)) continue;
      int mx = off[i] == off[i + 1] ? 1 : 0, ok = 1;     // no move at all: lost now
      for (uint32_t j = off[i]; j < off[i + 1] && ok; j++) {
        int32_t c = mch[j]; if (c == -1) { ok = 0; break; }
        uint16_t v = val[c]; if (!v || (v & 1)) { ok = 0; break; }
        if (v / 2 + 1 > mx) mx = v / 2 + 1;
      }
      if (ok && mx == d) { val[i] = 2 * d + 1; c2++; }
    }
    if (!c1 && !c2) break;
    longest = d;
  }
}

// --- simulations ---
static uint64_t rng = 88172645463325252ull;
static inline uint64_t xr(void) { rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17; return rng; }
static int msc(int32_t c) { if (c == -1) return 100000; uint16_t v = val[c]; if (!v) return 0; return (v & 1) ? 10000 - v / 2 : -10000 + v / 2; }
// mode 0: both sides play the table's best move, but each move is random with chance eps;
// mode 1: side pf plays perfectly, the other looks one move ahead (wins at once if it can, never
// leaves a win in one, otherwise random). Returns the winner, or 2 at the 300-move cap.
static int play(long s, double eps, int mode, int pf, int *len) {
  for (int ply = 0; ply < 300; ply++) {
    int side = s & 1; uint32_t a = off[s]; int n = off[s + 1] - a;
    *len = ply + 1;
    if (!n) return 1 - side;
    int pick = 0, perfect = mode == 0 ? !((xr() % 10000) < eps * 10000) : side == pf;
    if (mode == 0 && !perfect) pick = xr() % n;
    else if (perfect) { int best = -1 << 30, cn = 0; for (int j = 0; j < n; j++) { int sc = msc(mch[a + j]); if (sc > best) { best = sc; cn = 1; pick = j; } else if (sc == best && xr() % ++cn == 0) pick = j; } }
    else { int ok[64], k = 0, win = -1; for (int j = 0; j < n; j++) { int32_t c = mch[a + j]; if (c == -1) win = j; else if (val[c] != 2) ok[k++] = j; } pick = win >= 0 ? win : k ? ok[xr() % k] : (int)(xr() % n); }
    int32_t c = mch[a + pick];
    if (c == -1) return side;
    s = c;
  }
  *len = 300; return 2;
}
static long perft(long s, int d) {
  if (d == 0) return 1;
  uint32_t a = off[s]; int n = off[s + 1] - a; if (!n) return 1;
  long t = 0; for (int j = 0; j < n; j++) t += mch[a + j] == -1 ? 1 : perft(mch[a + j], d - 1);
  return t;
}
static void cname(int cell, char *b) { sprintf(b, "%c%d", 'a' + cell % C, R - cell / C); }
static const char *res(uint16_t v) { static char b[32]; if (!v) return "draw"; sprintf(b, "%s in %d", (v & 1) ? "loses" : "wins", v / 2); return b; }

int main(int argc, char **argv) {
  int mh[4] = {1, 2}, nm = 2, chh[4] = {1, 2}, ncr = 2, top = 0, balance = 0, perftD = 0, sunAt = 4;
  const char *dump = 0, *startArg = 0;
  for (int i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "--rc")) { R = atoi(argv[++i]); C = atoi(argv[++i]); }
    else if (!strcmp(argv[i], "--sun")) P = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--sunstep")) SUNSTEP = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--own")) OWN = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--diag")) DIAG = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--win")) WIN = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--nomove")) NOMOVE = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--mint")) nm = sscanf(argv[++i], "%d,%d,%d,%d", &mh[0], &mh[1], &mh[2], &mh[3]);
    else if (!strcmp(argv[i], "--coral")) ncr = sscanf(argv[++i], "%d,%d,%d,%d", &chh[0], &chh[1], &chh[2], &chh[3]);
    else if (!strcmp(argv[i], "--top")) top = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--balance")) balance = 1;
    else if (!strcmp(argv[i], "--perft")) perftD = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--dump")) dump = argv[++i];
    else if (!strcmp(argv[i], "--start")) startArg = argv[++i];
    else if (!strcmp(argv[i], "--sunat")) { const char *s = argv[++i]; for (int k = 0; k < 8; k++) if (!strcmp(s, SUNN[k])) sunAt = k; }
  }
  NC = R * C; TM = nm; T = nm + ncr;
  for (int t = 0; t < nm; t++) hgt[t] = mh[t];
  for (int t = 0; t < ncr; t++) hgt[nm + t] = chh[t];
  { static const int SR[8] = {-1, -1, 0, 1, 1, 1, 0, -1}, SC[8] = {0, 1, 1, 1, 0, -1, -1, -1};   // where the sun is
    for (int s = 0; s < 8; s++) { SDR[s] = -SR[s]; SDC[s] = -SC[s]; } }
  PH = P * SUNSTEP;
  NPOS = 1; for (int t = 0; t < T; t++) NPOS *= NC;
  NS = NPOS * PH * 2;
  build(); solve();
  if (dump) { FILE *f = fopen(dump, "wb"); fwrite(val, 2, NS, f); fclose(f); }

  long a = 0, b = 0, c = 0;
  for (long pos = 0; pos < NPOS; pos++) { if (!validPos(pos)) continue; for (int ph = 0; ph < PH; ph++) { uint16_t v = val[sidx(pos, ph, 0)]; if (!v) c++; else if (v & 1) b++; else a++; } }
  double tt = a + b + c;
  // home-row starts: Mint's towers on rank 1, Coral's on the half-turn squares; every sun place
  typedef struct { long pos; int ph, n0, s0, n1, s1; } Row; Row *rows = malloc(sizeof(Row) * 4096); int nr = 0, both[3] = {0, 0, 0};
  int cells[8]; long combos = 1; for (int t = 0; t < TM; t++) combos *= C;
  for (long m = 0; m < combos && TM == T - TM; m++) {
    long x = m; int okc = 1;
    for (int t = 0; t < TM; t++) { cells[t] = (R - 1) * C + x % C; x /= C; }
    for (int t = 0; t < TM; t++) for (int u = t + 1; u < TM; u++) if (cells[t] == cells[u]) okc = 0;
    if (!okc) continue;
    for (int t = 0; t < TM; t++) cells[TM + t] = NC - 1 - cells[t];
    long pos = encode(cells);
    for (int ph = 0; ph < PH; ph++) {
      uint16_t v0 = val[sidx(pos, ph, 0)], v1 = val[sidx(pos, ph, 1)];
      both[(v0 == 0) + (v1 == 0)]++;
      if (v0 || v1) continue;
      Row rw = {pos, ph, 0, 0, 0, 0};
      for (int side = 0; side < 2; side++) {
        long st = sidx(pos, ph, side); int n = off[st + 1] - off[st], sf = 0;
        for (uint32_t j = off[st]; j < off[st + 1]; j++) { int32_t ch = mch[j]; if (ch >= 0 && (!val[ch] || (val[ch] & 1))) sf++; }
        if (side) { rw.n1 = n; rw.s1 = sf; } else { rw.n0 = n; rw.s0 = sf; }
      }
      if (nr < 4096) rows[nr++] = rw;
    }
  }
  printf("R%d C%d mint", R, C); for (int t = 0; t < TM; t++) printf("%s%d", t ? "," : " ", hgt[t]);
  printf(" coral"); for (int t = TM; t < T; t++) printf("%s%d", t > TM ? "," : " ", hgt[t]);
  printf(" sun%d step%d own%d diag%d win%d nomove%d | win %.1f%% loss %.1f%% draw %.1f%% longest %d | home starts x sun: fair %d, one-side-draw %d, decided %d\n",
         P, SUNSTEP, OWN, DIAG, WIN, NOMOVE, 100 * a / tt, 100 * b / tt, 100 * c / tt, longest, both[2], both[1], both[0]);
  fflush(stdout);

  if (startArg) {
    int k = 0; const char *q = startArg;
    while (*q && k < TM) { cells[k++] = (R - (q[1] - '0')) * C + (q[0] - 'a'); while (*q && *q != ',') q++; if (*q) q++; }
    for (int t = 0; t < TM; t++) cells[TM + t] = NC - 1 - cells[t];
    long pos = encode(cells); int ph = (P == 8 ? sunAt : sunAt / 2) * SUNSTEP;
    char bf[8];
    for (int side = 0; side < 2; side++) {
      long st = sidx(pos, ph, side);
      printf("%s moves first, sun %s: %s\n", side ? "Coral" : "Mint", SUNN[sunPlace(ph)], res(val[st]));
      int32_t out[64]; int mt[64], md[64]; int n = gen(pos, ph, side, out, mt, md);
      for (int j = 0; j < n; j++) {
        if (mt[j] < 0) { printf("  pass -> %s\n", res(val[out[j]])); continue; }
        cname(cells[mt[j]], bf); printf("  %s tower %s", hgt[mt[j]] == 1 ? "short" : "tall", bf); cname(md[j], bf);
        printf(" -> %s: %s\n", bf, out[j] == -1 ? "wins at once" : val[out[j]] == 0 ? "draw" : (val[out[j]] & 1) ? "the other side loses" : "the other side wins");
        if (out[j] >= 0 && val[out[j]] && !(val[out[j]] & 1)) printf("      (within %d more moves)\n", val[out[j]] / 2);
      }
      if (perftD) { for (int d = 1; d <= perftD; d++) printf("perft %d %ld\n", d, perft(st, d)); continue; }
      int w[3] = {0, 0, 0}; long len = 0;
      for (int g = 0; g < 20000; g++) { int l; w[play(st, 0.1, 0, 0, &l)]++; len += l; }
      printf("  10%% slips: first %.1f%% second %.1f%% draw %.1f%%, %.0f moves on average\n", 100.0 * w[side] / 20000, 100.0 * w[1 - side] / 20000, 100.0 * w[2] / 20000, (double)len / 20000);
      for (int pf = 0; pf < 2; pf++) {
        int pw = 0; long pl = 0;
        for (int g = 0; g < 4000; g++) { int l; if (play(st, 0, 1, pf, &l) == pf) pw++; pl += l; }
        printf("  perfect play as %s (%s) beats a one-move player %.1f%%, %.0f moves on average\n", pf ? "Coral" : "Mint", pf == side ? "first" : "second", 100.0 * pw / 4000, (double)pl / 4000);
      }
    }
  }

  if (top) {
    double *gap = 0;
    if (balance) {
      gap = malloc(sizeof(double) * nr);
      for (int i = 0; i < nr; i++) {
        double g = 0;
        for (int side = 0; side < 2; side++) {
          long st = sidx(rows[i].pos, rows[i].ph, side); int w[3] = {0, 0, 0};
          for (int q2 = 0; q2 < 4000; q2++) { int l; w[play(st, 0.1, 0, 0, &l)]++; }
          g += (w[side] - w[1 - side]) / 4000.0;
        }
        gap[i] = g / 2;
      }
    }
    for (int i = 0; i < nr; i++) for (int j = i + 1; j < nr; j++) {
      int swap;
      if (gap) { double gi = gap[i] < 0 ? -gap[i] : gap[i], gj = gap[j] < 0 ? -gap[j] : gap[j]; swap = gj < gi; }
      else swap = rows[j].n0 + rows[j].n1 - rows[j].s0 - rows[j].s1 > rows[i].n0 + rows[i].n1 - rows[i].s0 - rows[i].s1;
      if (swap) { Row q2 = rows[i]; rows[i] = rows[j]; rows[j] = q2; if (gap) { double t2 = gap[i]; gap[i] = gap[j]; gap[j] = t2; } }
    }
    for (int i = 0; i < nr && i < top; i++) {
      decode(rows[i].pos, cells); char bf[8];
      printf("  start mint");
      for (int t = 0; t < TM; t++) { cname(cells[t], bf); printf(" %s(h%d)", bf, hgt[t]); }
      printf(" sun %s | first moves that hold: Mint first %d of %d, Coral first %d of %d", SUNN[sunPlace(rows[i].ph)], rows[i].s0, rows[i].n0, rows[i].s1, rows[i].n1);
      if (gap) printf(" | quick first-minus-second %.1f points", 100 * gap[i]);
      printf("\n");
    }
  }
  return 0;
}
