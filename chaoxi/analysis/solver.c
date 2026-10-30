// Solver for 潮汐 Chaoxi (GambitAura Game 06): a tide rises and falls on a fixed schedule.
// Board 5 x 5, cell = row*5+col, row 0 at the top (rank 5). Every square has a ground height 0..3;
// both home rows are 3. The tide goes through --tide levels (shipped 0,1,2,3,2,1), one step after
// every move. A square is water while its height is below the tide. Each side has 2 pieces.
// A turn (shipped rules): step one piece one square (N E S W) onto an empty square that is dry now.
// A piece standing in water cannot move until the water falls (--flood 1). A side with no move
// passes. Win: a piece on the middle of the far edge (Mint c5, Coral c1). Threefold repetition is a
// draw (positions with no forced result stay draws here).
// Drafts kept as options: --flood 0 (a piece caught by water is swept off the board; bringing it
// back onto your home row takes a move), --push 1 (step into a piece to push it one square on),
// --win 0 (any square of the far row wins), --nomove 1 (a side with no move loses).
// Values: 0 draw, 2d = side to move wins in d plies, 2d+1 = loses in d plies.
// State index: (pos * phases + phase) * 2 + side, pos = ((c1*26 + c0)*26 + m1)*26 + m0 with each
// side's two squares in increasing order (26 = off the board). engine.js hashKey() is the same.
//
// Shipped terrain (ranks 4, 3, 2; ranks 5 and 1 are shores at 3): 21323 / 10101 / 32312, a channel
// across the middle with four rocks (c4 e4 a2 c2). Opening: Mint d1 e1, Coral a5 b5, tide at 0.
// Build: gcc -O3 -march=native -fopenmp -o solver solver.c
// Use:   ./solver --start d1,e1 --phase 0             every first move, simulations
//        ./solver --start d1,e1 --phase 0 --perft 6   move counts; must match perft() in ../engine.js
//        ./solver --dump table.bin                    the table for check_table.mjs and probe_ai.mjs
//        ./solver --top 8                             fair home-row starts, most even first
//        ./solver --scan 200 --seed 7                 200 random half-turn symmetric terrains
//        ./solver --flood 0                           the first draft: swept off the board
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <omp.h>

#define R 5
#define C 5
#define NC 25
#define OFF 25
static int H[NC], TIDE[16], TP = 6, PUSH = 0, FLOOD = 1, WIN = 1, NOMOVE = 0;
static long NPOS = 26L * 26 * 26 * 26, NS;
static uint32_t *off; static int32_t *mch;
static uint16_t *val; static int longest;
static const int DR[4] = {-1, 0, 1, 0}, DC[4] = {0, 1, 0, -1};

static void decode(long pos, int *p) { for (int t = 0; t < 4; t++) { p[t] = pos % 26; pos /= 26; } }
static long encode(const int *p) { return ((long)(p[3] * 26 + p[2]) * 26 + p[1]) * 26 + p[0]; }
// canonical order inside each side (p0 <= p1, p2 <= p3) halves the table
static int validPos(long pos) {
  int p[4]; decode(pos, p);
  for (int a = 0; a < 4; a++) for (int b = a + 1; b < 4; b++) if (p[a] < OFF && p[a] == p[b]) return 0;
  if (p[0] > p[1] || p[2] > p[3]) return 0;
  return 1;
}
static long canon(int *p) { int q[4] = {p[0], p[1], p[2], p[3]}; if (q[0] > q[1]) { int t = q[0]; q[0] = q[1]; q[1] = t; } if (q[2] > q[3]) { int t = q[2]; q[2] = q[3]; q[3] = t; } return encode(q); }
static inline long sidx(long pos, int ph, int side) { return (pos * TP + ph) * 2 + side; }
static inline int wet(int cell, int ph) { return H[cell] < TIDE[ph]; }
static int isTarget(int side, int cell) { int far = side ? R - 1 : 0; if (cell >= OFF) return 0; return cell / C == far && (WIN == 0 || cell % C == C / 2); }

// apply tide and flood after a move; returns child state index or -1 mover wins, -2 mover loses
static long finish(int *p, int ph, int side) {
  int nph = (ph + 1) % TP;
  int me = side, ot = 1 - side;
  int meWin = isTarget(me, p[me * 2]) || isTarget(me, p[me * 2 + 1]);
  int otWin = isTarget(ot, p[ot * 2]) || isTarget(ot, p[ot * 2 + 1]);
  if (meWin) return -1;
  if (otWin) return -2;
  if (FLOOD == 0) for (int t = 0; t < 4; t++) if (p[t] < OFF && wet(p[t], nph)) p[t] = OFF;
  return sidx(canon(p), nph, 1 - side);
}
static int gen(long pos, int ph, int side, int32_t *out, int *desc) {
  int p[4]; decode(pos, p);
  uint32_t occ = 0; for (int t = 0; t < 4; t++) if (p[t] < OFF) occ |= 1u << p[t];
  int n = 0;
  for (int k = 0; k < 2; k++) {
    int t = side * 2 + k, from = p[t];
    if (k == 1 && p[t] == p[t - 1] && from == OFF) continue;   // two pieces off: one re-entry list
    if (from == OFF) {
      int row = side ? 0 : R - 1;
      for (int c = 0; c < C; c++) {
        int cell = row * C + c; if (occ >> cell & 1) continue;
        int q[4] = {p[0], p[1], p[2], p[3]}; q[t] = cell;
        if (desc) desc[n] = 10000 + cell;
        out[n++] = (int32_t)finish(q, ph, side);
      }
      continue;
    }
    if (FLOOD == 1 && wet(from, ph)) continue;   // stranded
    for (int d = 0; d < 4; d++) {
      int r = from / C + DR[d], c = from % C + DC[d];
      if (r < 0 || r >= R || c < 0 || c >= C) continue;
      int to = r * C + c;
      if (wet(to, ph)) continue;
      int q[4] = {p[0], p[1], p[2], p[3]};
      if (occ >> to & 1) {
        if (!PUSH) continue;
        int r2 = r + DR[d], c2 = c + DC[d];
        if (r2 < 0 || r2 >= R || c2 < 0 || c2 >= C) continue;
        int to2 = r2 * C + c2; if (occ >> to2 & 1) continue;
        for (int u = 0; u < 4; u++) if (q[u] == to) q[u] = to2;
      }
      q[t] = to;
      if (desc) desc[n] = from * 100 + to;
      out[n++] = (int32_t)finish(q, ph, side);
    }
  }
  if (!n && !NOMOVE) { int q[4] = {p[0], p[1], p[2], p[3]}; if (desc) desc[n] = -1; out[n++] = (int32_t)finish(q, ph, side); }
  return n;
}
static void build(void) {
  NS = NPOS * TP * 2;
  uint32_t *cnt = calloc(NS, 4);
#pragma omp parallel for schedule(dynamic, 1024)
  for (long pos = 0; pos < NPOS; pos++) { if (!validPos(pos)) continue; int32_t tmp[64]; for (int ph = 0; ph < TP; ph++) for (int s = 0; s < 2; s++) cnt[sidx(pos, ph, s)] = gen(pos, ph, s, tmp, 0); }
  off = malloc(sizeof(uint32_t) * (NS + 1)); off[0] = 0;
  for (long i = 0; i < NS; i++) off[i + 1] = off[i] + cnt[i];
  mch = malloc(sizeof(int32_t) * (off[NS] + 1));
#pragma omp parallel for schedule(dynamic, 1024)
  for (long pos = 0; pos < NPOS; pos++) { if (!validPos(pos)) continue; for (int ph = 0; ph < TP; ph++) for (int s = 0; s < 2; s++) gen(pos, ph, s, mch + off[sidx(pos, ph, s)], 0); }
  free(cnt);
}
static void solve(void) {
  free(val); val = calloc(NS, 2); longest = 0;
  for (int d = 1;; d++) {
    long c1 = 0, c2 = 0;
#pragma omp parallel for schedule(dynamic, 8192) reduction(+:c1)
    for (long i = 0; i < NS; i++) {
      if (val[i] || !validPos(i / 2 / TP)) continue;
      for (uint32_t j = off[i]; j < off[i + 1]; j++) { int32_t c = mch[j]; if ((c == -1 && d == 1) || (c >= 0 && d >= 2 && val[c] == 2 * (d - 1) + 1)) { val[i] = 2 * d; c1++; break; } }
    }
#pragma omp parallel for schedule(dynamic, 8192) reduction(+:c2)
    for (long i = 0; i < NS; i++) {
      if (val[i] || !validPos(i / 2 / TP)) continue;
      int mx = off[i] == off[i + 1] ? 1 : 0, ok = 1;
      for (uint32_t j = off[i]; j < off[i + 1] && ok; j++) {
        int32_t c = mch[j]; int con;
        if (c == -1) { ok = 0; break; }
        if (c == -2) con = 1; else { uint16_t v = val[c]; if (!v || (v & 1)) { ok = 0; break; } con = v / 2 + 1; }
        if (con > mx) mx = con;
      }
      if (ok && mx == d) { val[i] = 2 * d + 1; c2++; }
    }
    if (!c1 && !c2) break;
    longest = d;
  }
}
static uint64_t rng = 88172645463325252ull;
static inline uint64_t xr(void) { rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17; return rng; }
static int msc(int32_t c) { if (c == -1) return 100000; if (c == -2) return -100000; uint16_t v = val[c]; if (!v) return 0; return (v & 1) ? 10000 - v / 2 : -10000 + v / 2; }
static int play(long s, double eps, int mode, int pf, int *len) {
  for (int ply = 0; ply < 300; ply++) {
    int side = s & 1; uint32_t a = off[s]; int n = off[s + 1] - a;
    *len = ply + 1;
    if (!n) return 1 - side;
    int pick = 0, perfect = mode == 0 ? !((xr() % 10000) < eps * 10000) : side == pf;
    if (mode == 0 && !perfect) pick = xr() % n;
    else if (perfect) { int best = -1 << 30, cn = 0; for (int j = 0; j < n; j++) { int sc = msc(mch[a + j]); if (sc > best) { best = sc; cn = 1; pick = j; } else if (sc == best && xr() % ++cn == 0) pick = j; } }
    else { int ok[64], k = 0, win = -1; for (int j = 0; j < n; j++) { int32_t c = mch[a + j]; if (c == -1) win = j; else if (c == -2) continue; else if (val[c] != 2) ok[k++] = j; } pick = win >= 0 ? win : k ? ok[xr() % k] : (int)(xr() % n); }
    int32_t c = mch[a + pick];
    if (c == -1) return side;
    if (c == -2) return 1 - side;
    s = c;
  }
  *len = 300; return 2;
}
long perft(long s, int d) {
  if (d == 0) return 1;
  uint32_t a = off[s]; int n = off[s + 1] - a; if (!n) return 1;
  long t = 0; for (int j = 0; j < n; j++) t += mch[a + j] < 0 ? 1 : perft(mch[a + j], d - 1);
  return t;
}
static void cname(int cell, char *b) { if (cell >= OFF || cell < 0) sprintf(b, "off"); else sprintf(b, "%c%d", 'a' + cell % C, R - cell / C); }

typedef struct { int c0, c1, ph, n, safe; double gap; } Start;
// home starts: Mint's two pieces on its home row, Coral's a half turn away, every tide phase
static int homeStarts(Start *out, int *fair) {
  int ns = 0; *fair = 0;
  for (int a = 0; a < C; a++) for (int b = a + 1; b < C; b++) for (int ph = 0; ph < TP; ph++) {
    int p[4] = {(R - 1) * C + a, (R - 1) * C + b, NC - 1 - ((R - 1) * C + b), NC - 1 - ((R - 1) * C + a)};
    long st = sidx(canon(p), ph, 0); if (val[st]) continue;
    (*fair)++;
    int n = off[st + 1] - off[st], safe = 0;
    for (uint32_t j = off[st]; j < off[st + 1]; j++) { int32_t ch = mch[j]; if (ch >= 0 && (!val[ch] || (val[ch] & 1))) safe++; }
    out[ns++] = (Start){(R - 1) * C + a, (R - 1) * C + b, ph, n, safe, 0};
  }
  return ns;
}

int main(int argc, char **argv) {
  const char *layout = "21323;10101;32312", *tide = "0,1,2,3,2,1"; const char *dump = 0; int scan = 0, top = 0, phase = 0, perftD = 0; unsigned seed = 1; const char *startArg = 0;
  for (int i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "--layout")) layout = argv[++i];
    else if (!strcmp(argv[i], "--tide")) tide = argv[++i];
    else if (!strcmp(argv[i], "--push")) PUSH = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--flood")) FLOOD = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--win")) WIN = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--nomove")) NOMOVE = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--scan")) scan = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--seed")) seed = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--top")) top = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--start")) startArg = argv[++i];
    else if (!strcmp(argv[i], "--phase")) phase = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--perft")) perftD = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--dump")) dump = argv[++i];
  }
  TP = 0; for (const char *q = tide; *q; ) { TIDE[TP++] = atoi(q); while (*q && *q != ',') q++; if (*q) q++; }
  for (int c = 0; c < C; c++) { H[c] = 3; H[(R - 1) * C + c] = 3; }
  int layouts = scan ? scan : 1;
  srand(seed);
  int built = 0;
  for (int L = 0; L < layouts; L++) {
    char lay[32];
    if (scan) {
      // random half-turn symmetric interior: rows 1..3, heights 0..3
      int h[15];
      for (int k = 0; k < 15; k++) h[k] = -1;
      for (int k = 0; k < 15; k++) if (h[k] < 0) { int v = rand() % 4; h[k] = v; h[14 - k] = v; }
      for (int r = 0; r < 3; r++) for (int c = 0; c < C; c++) H[(r + 1) * C + c] = h[r * C + c];
      int w = 0; for (int r = 0; r < 3; r++) { for (int c = 0; c < C; c++) lay[w++] = '0' + h[r * C + c]; lay[w++] = r < 2 ? ';' : 0; }
    } else {
      int r = 1, c = 0; for (const char *q = layout; *q; q++) { if (*q == ';') { r++; c = 0; continue; } H[r * C + c] = *q - '0'; c++; }
      strcpy(lay, layout);
    }
    if (built) { free(off); free(mch); }
    build(); built = 1; solve();
    if (dump && !scan) { FILE *f = fopen(dump, "wb"); fwrite(val, 2, NS, f); fclose(f); }
    long a = 0, b = 0, d0 = 0;
    for (long pos = 0; pos < NPOS; pos++) { if (!validPos(pos)) continue; int p[4]; decode(pos, p); if (p[0] == OFF || p[2] == OFF) continue; for (int ph = 0; ph < TP; ph++) { uint16_t v = val[sidx(pos, ph, 0)]; if (!v) d0++; else if (v & 1) b++; else a++; } }
    double tt = a + b + d0;
    Start st[256]; int fair; int ns = homeStarts(st, &fair);
    int withTraps = 0; for (int k = 0; k < ns; k++) if (st[k].safe >= 1 && st[k].safe < st[k].n) withTraps++;
    printf("layout %s tide %s push%d flood%d win%d | win %.1f%% loss %.1f%% draw %.1f%% longest %d | home starts x tide: fair %d of %d, with traps %d\n",
           lay, tide, PUSH, FLOOD, WIN, 100 * a / tt, 100 * b / tt, 100 * d0 / tt, longest, fair, 10 * TP, withTraps);
    fflush(stdout);
    if (startArg) {
      int cells[2], k = 0; const char *q = startArg;
      while (*q && k < 2) { cells[k++] = (R - (q[1] - '0')) * C + (q[0] - 'a'); while (*q && *q != ',') q++; if (*q) q++; }
      int p[4] = {cells[0], cells[1], NC - 1 - cells[1], NC - 1 - cells[0]};
      long s0 = sidx(canon(p), phase, 0); uint16_t v = val[s0];
      printf("start Mint %s, tide phase %d (level %d), Mint first: %s %d\n", startArg, phase, TIDE[phase], !v ? "draw" : (v & 1) ? "loses in" : "wins in", v / 2);
      int32_t out[64]; int desc[64]; long pos0 = canon(p); int n = gen(pos0, phase, 0, out, desc);
      for (int j = 0; j < n; j++) {
        char x[8], y[8];
        if (desc[j] >= 10000) { cname(desc[j] - 10000, y); printf("  enter %s", y); }
        else if (desc[j] < 0) printf("  pass");
        else { cname(desc[j] / 100, x); cname(desc[j] % 100, y); printf("  %s-%s", x, y); }
        int32_t c = out[j]; uint16_t w = c >= 0 ? val[c] : 0;
        printf(" -> %s", c == -1 ? "wins at once" : c == -2 ? "loses at once" : !w ? "draw" : (w & 1) ? "Coral loses" : "Coral wins");
        if (c >= 0 && w && !(w & 1)) printf(" within %d more moves", w / 2);
        printf("\n");
      }
      if (perftD) { long perft(long, int); for (int d = 1; d <= perftD; d++) printf("perft %d %ld\n", d, perft(s0, d)); }
      else {
        int w[3] = {0, 0, 0}; long len = 0; for (int g = 0; g < 20000; g++) { int l; w[play(s0, 0.1, 0, 0, &l)]++; len += l; }
        printf("  10%% slips: first %.1f%% second %.1f%% draw %.1f%%, %.0f moves on average\n", 100.0 * w[0] / 20000, 100.0 * w[1] / 20000, 100.0 * w[2] / 20000, len / 20000.0);
        for (int side = 0; side < 2; side++) { int pw = 0; long pl = 0; for (int g = 0; g < 4000; g++) { int l; if (play(s0, 0, 1, side, &l) == side) pw++; pl += l; }
          printf("  perfect play %s beats a one-move player %.1f%%, %.0f moves on average\n", side ? "second" : "first", 100.0 * pw / 4000, pl / 4000.0); }
      }
    }
    if (top) {
      for (int k = 0; k < ns; k++) {
        long s0 = sidx(({ int p[4] = {st[k].c0, st[k].c1, NC - 1 - st[k].c1, NC - 1 - st[k].c0}; canon(p); }), st[k].ph, 0);
        int w[3] = {0, 0, 0}; for (int g = 0; g < 4000; g++) { int l; w[play(s0, 0.1, 0, 0, &l)]++; }
        st[k].gap = (w[0] - w[1]) / 40.0;
      }
      for (int i = 0; i < ns; i++) for (int j = i + 1; j < ns; j++) {
        int ti = st[i].safe >= 1 && st[i].safe < st[i].n, tj = st[j].safe >= 1 && st[j].safe < st[j].n;
        double gi = (st[i].gap < 0 ? -st[i].gap : st[i].gap) + (ti ? 0 : 100), gj = (st[j].gap < 0 ? -st[j].gap : st[j].gap) + (tj ? 0 : 100);
        if (gj < gi) { Start x = st[i]; st[i] = st[j]; st[j] = x; }
      }
      for (int k = 0; k < ns && k < top; k++) {
        char x[8], y[8]; cname(st[k].c0, x); cname(st[k].c1, y);
        long s0 = sidx(({ int p[4] = {st[k].c0, st[k].c1, NC - 1 - st[k].c1, NC - 1 - st[k].c0}; canon(p); }), st[k].ph, 0);
        int w[3] = {0, 0, 0}; long len = 0; for (int g = 0; g < 20000; g++) { int l; w[play(s0, 0.1, 0, 0, &l)]++; len += l; }
        int pw = 0, pw2 = 0; long pl = 0; for (int g = 0; g < 4000; g++) { int l; if (play(s0, 0, 1, 0, &l) == 0) pw++; pl += l; if (play(s0, 0, 1, 1, &l) == 1) pw2++; }
        printf("  start %s %s tide phase %d (level %d) | %d of %d first moves hold | 10%% slips %.1f/%.1f/%.1f len %.0f | perfect beats 1-ply %.1f%% first, %.1f%% second (len %.0f)\n",
               x, y, st[k].ph, TIDE[st[k].ph], st[k].safe, st[k].n, 100.0 * w[0] / 20000, 100.0 * w[1] / 20000, 100.0 * w[2] / 20000, len / 20000.0, 100.0 * pw / 4000, 100.0 * pw2 / 4000, pl / 4000.0);
      }
    }
  }
  return 0;
}
