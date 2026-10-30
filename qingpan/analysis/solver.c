// Solver for 傾盤 Qingpan (GambitAura Game 05): tilt the board, every piece slides.
// Board R x C (5 x 5), cell = row*C + col, row 0 at the top (rank 5). Fixed pillars and two holes:
// Mint's target and Coral's, a half turn apart. Each side has K pieces. A turn: tilt the board
// N/E/S/W (every piece of both sides slides until it meets the edge, a pillar, a piece or the other
// side's hole; a piece that slides into its own hole falls in), or step one own piece one square
// (into an empty square, or into its own hole). After a move: if a mover's piece fell in, the mover
// wins; else if the other side's did, the other side wins. A tilt must move something. --ban 2
// (shipped): no tilting straight back the way the other side just tilted (bit 1 would ban the same
// way, which never matters: a tilt the same way moves nothing). A side with no move passes.
// Values: 0 = draw, 2d = side to move wins in d plies, 2d+1 = loses in d plies.
// State index: ((rank(Mint) * CK + rank(Coral)) * 5 + last tilt (0..3, 4 = none)) * 2 + side, where
// rank is the colex rank of a side's K-subset of the free squares (all squares but pillars and holes,
// in increasing order) and CK = C(free, K). engine.js computes the same number in hashKey().
//
// Shipped design: pillars b5 d1, Mint's hole a4 (Coral's e2), 3 pieces each, tilt or step, no
// tilting straight back. Opening: Mint c2 d2 c1, Coral c4 b4 c5.
// Build: gcc -O3 -march=native -fopenmp -o solver solver.c
// Use:   ./solver --start c2,d2,c1                  every first move, simulations
//        ./solver --start c2,d2,c1 --perft 6        move counts; must match perft() in ../engine.js
//        ./solver --dump table.bin                  the table for check_table.mjs and probe_ai.mjs
//        ./solver --top 4 --minmoves 4 --balance --half   the most even fair starts in own halves
//        ./solver --pillars "1,1;1,3" --hole 1 2 --step 0 --top 4 --minmoves 2 --balance
//                                                   the tilt-only design (longest forced win 49 too)
// --pillars lists r,c pairs (row 0 at the top); each also places its half-turn twin. --hole r c is
// Mint's hole; Coral's is its half-turn twin.
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <omp.h>

static int R = 5, C = 5, K = 3, STEP = 1, BAN = 2, NULLT = 0, NCELL, N;
static int type[64], fidx[64], fcell[64];   // type: 0 floor, 1 pillar, 2 Mint hole, 3 Coral hole
static int holeM = -1;
static long binom[40][8];
static int CK;                 // C(N, K)
static uint32_t *subs;         // subset masks over free indices, colex order
static const int DR[4] = {-1, 0, 1, 0}, DC[4] = {0, 1, 0, -1};
static int L = 5;              // last tilt direction 0..3, 4 = none
static long NB, NS;            // bases (rm*CK+rc), states
static uint32_t *off;          // CSR offsets per (base, side)
static int32_t *mchild;        // child base, or -1 immediate win, -2 immediate loss
static uint8_t *mdir;          // 0..3 tilt direction, 4 step
static uint16_t *val;
static int longest;

static int rot(int cell) { return NCELL - 1 - cell; }
static int rankOf(uint32_t m) { int r = 0, i = 0; while (m) { int p = __builtin_ctz(m); m &= m - 1; r += binom[p][++i]; } return r; }

// apply a move; returns 0 illegal, 1 ordinary (out masks set), 2 mover wins, 3 mover loses
static int doTilt(uint32_t mm, uint32_t cm, int side, int d, uint32_t *om, uint32_t *oc) {
  int occ[64] = {0};
  for (int i = 0; i < N; i++) { if (mm >> i & 1) occ[fcell[i]] = 1; if (cm >> i & 1) occ[fcell[i]] = 2; }
  int moved = 0, fell[3] = {0, 0, 0};
  for (int s = 0; s < NCELL; s++) {
    int cell;
    int r0, c0;
    if (d == 0) cell = s; else if (d == 2) cell = NCELL - 1 - s;
    else if (d == 1) { c0 = C - 1 - s / R; r0 = s % R; cell = r0 * C + c0; }
    else { c0 = s / R; r0 = s % R; cell = r0 * C + c0; }
    int p = occ[cell]; if (!p) continue;
    int cur = cell;
    for (;;) {
      int r = cur / C + DR[d], c = cur % C + DC[d];
      if (r < 0 || r >= R || c < 0 || c >= C) break;
      int n = r * C + c, t = type[n];
      if (t == 1) break;
      if (t >= 2) { if ((t == 2 && p == 1) || (t == 3 && p == 2)) { occ[cur] = 0; fell[p] = 1; moved = 1; } break; }
      if (occ[n]) break;
      occ[n] = p; occ[cur] = 0; cur = n; moved = 1;
    }
  }
  if (!moved && !NULLT) return 0;
  int me = side ? 2 : 1, ot = side ? 1 : 2;
  if (fell[me]) return 2;
  if (fell[ot]) return 3;
  uint32_t a = 0, b = 0;
  for (int i = 0; i < N; i++) { if (occ[fcell[i]] == 1) a |= 1u << i; if (occ[fcell[i]] == 2) b |= 1u << i; }
  *om = a; *oc = b; return 1;
}

static void build(void) {
  NB = (long)CK * CK;
  off = calloc(NB * 2 + 1, sizeof(uint32_t));
  // first pass: count
  int *cnt = calloc(NB * 2, sizeof(int));
#pragma omp parallel for schedule(dynamic, 64)
  for (long b = 0; b < NB; b++) {
    uint32_t mm = subs[b / CK], cm = subs[b % CK];
    if (mm & cm) continue;
    for (int side = 0; side < 2; side++) {
      int n = 0; uint32_t om, oc;
      for (int d = 0; d < 4; d++) if (doTilt(mm, cm, side, d, &om, &oc)) n++;
      if (STEP) {
        uint32_t own = side ? cm : mm;
        for (uint32_t x = own; x; x &= x - 1) {
          int cell = fcell[__builtin_ctz(x)];
          for (int d = 0; d < 4; d++) {
            int r = cell / C + DR[d], c = cell % C + DC[d];
            if (r < 0 || r >= R || c < 0 || c >= C) continue;
            int t = type[r * C + c];
            if (t == 1) continue;
            if (t >= 2) { if (t == 2 + side) n++; continue; }
            int fi = fidx[r * C + c]; if (((mm | cm) >> fi) & 1) continue;
            n++;
          }
        }
      }
      cnt[b * 2 + side] = n;
    }
  }
  for (long i = 0; i < NB * 2; i++) off[i + 1] = off[i] + cnt[i];
  long tot = off[NB * 2];
  mchild = malloc(sizeof(int32_t) * tot); mdir = malloc(tot);
#pragma omp parallel for schedule(dynamic, 64)
  for (long b = 0; b < NB; b++) {
    uint32_t mm = subs[b / CK], cm = subs[b % CK];
    if (mm & cm) continue;
    for (int side = 0; side < 2; side++) {
      long w = off[b * 2 + side]; uint32_t om, oc;
      for (int d = 0; d < 4; d++) {
        int r = doTilt(mm, cm, side, d, &om, &oc);
        if (!r) continue;
        mchild[w] = r == 2 ? -1 : r == 3 ? -2 : (int32_t)((long)rankOf(om) * CK + rankOf(oc)); mdir[w++] = d;
      }
      if (STEP) {
        uint32_t own = side ? cm : mm;
        for (uint32_t x = own; x; x &= x - 1) {
          int fi0 = __builtin_ctz(x), cell = fcell[fi0];
          for (int d = 0; d < 4; d++) {
            int r = cell / C + DR[d], c = cell % C + DC[d];
            if (r < 0 || r >= R || c < 0 || c >= C) continue;
            int t = type[r * C + c];
            if (t == 1) continue;
            if (t >= 2) { if (t == 2 + side) { mchild[w] = -1; mdir[w++] = 4; } continue; }
            int fi = fidx[r * C + c]; if (((mm | cm) >> fi) & 1) continue;
            uint32_t nm = mm, nc = cm;
            if (side) nc = (cm & ~(1u << fi0)) | (1u << fi); else nm = (mm & ~(1u << fi0)) | (1u << fi);
            mchild[w] = (int32_t)((long)rankOf(nm) * CK + rankOf(nc)); mdir[w++] = 4;
          }
        }
      }
    }
  }
  free(cnt);
}

static inline int banned(int last, int d) {
  if (last == 4 || d == 4) return 0;
  if ((BAN & 1) && d == last) return 1;
  if ((BAN & 2) && d == (last + 2) % 4) return 1;
  return 0;
}
static inline long sidx(long base, int last, int side) { return (base * L + last) * 2 + side; }

// Successor list of a state as (kind, child state): kind 1 imm win, 2 imm loss, 0 child.
static int succ(long st, int *kind, long *ch) {
  int side = st & 1; long rest = st / 2; int last = rest % L; long base = rest / L;
  int n = 0;
  for (uint32_t j = off[base * 2 + side]; j < off[base * 2 + side + 1]; j++) {
    int d = mdir[j]; if (banned(last, d)) continue;
    if (mchild[j] == -1) { kind[n] = 1; ch[n++] = -1; }
    else if (mchild[j] == -2) { kind[n] = 2; ch[n++] = -1; }
    else { kind[n] = 0; ch[n++] = sidx(mchild[j], d, 1 - side); }
  }
  if (!n) { kind[0] = 0; ch[0] = sidx(base, 4, 1 - side); n = 1; }
  return n;
}
static int validState(long st) { long base = st / 2 / L; return !(subs[base / CK] & subs[base % CK]); }

static void solve(void) {
  NS = NB * L * 2;
  val = calloc(NS, 2);
  longest = 0;
  for (int d = 1;; d++) {
    long ch1 = 0, ch2 = 0;
#pragma omp parallel for schedule(dynamic, 4096) reduction(+:ch1)
    for (long i = 0; i < NS; i++) {
      if (val[i] || !validState(i)) continue;
      int kind[64]; long c[64]; int n = succ(i, kind, c);
      for (int j = 0; j < n; j++) {
        if ((kind[j] == 1 && d == 1) || (kind[j] == 0 && d >= 2 && val[c[j]] == 2 * (d - 1) + 1)) { val[i] = 2 * d; ch1++; break; }
      }
    }
#pragma omp parallel for schedule(dynamic, 4096) reduction(+:ch2)
    for (long i = 0; i < NS; i++) {
      if (val[i] || !validState(i)) continue;
      int kind[64]; long c[64]; int n = succ(i, kind, c), mx = 0, ok = 1;
      for (int j = 0; j < n && ok; j++) {
        int contrib;
        if (kind[j] == 1) { ok = 0; break; }
        if (kind[j] == 2) contrib = 1;
        else { uint16_t v = val[c[j]]; if (!v || (v & 1)) { ok = 0; break; } contrib = v / 2 + 1; }
        if (contrib > mx) mx = contrib;
      }
      if (ok && mx == d) { val[i] = 2 * d + 1; ch2++; }
    }
    if (!ch1 && !ch2) break;
    longest = d;
  }
}

static uint64_t rng = 88172645463325252ull;
static inline uint64_t xr(void) { rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17; return rng; }
// score of a move for the mover, from the child value (opponent to move)
static int mscore(int kind, long ch) {
  if (kind == 1) return 100000;
  if (kind == 2) return -100000;
  uint16_t v = val[ch]; if (!v) return 0;
  return (v & 1) ? 10000 - (int)(v / 2) : -10000 + (int)(v / 2);
}
static long perft(long s, int d) {
  if (d == 0) return 1;
  int kind[64]; long c[64]; int n = succ(s, kind, c); long t = 0;
  for (int j = 0; j < n; j++) t += kind[j] ? 1 : perft(c[j], d - 1);
  return t;
}
static long startState(uint32_t mm, uint32_t cm) { return sidx((long)rankOf(mm) * CK + rankOf(cm), 4, 0); }

// play one game; mode 0: both perfect with slip eps; mode 1: perfect (side pf) vs one-move player
static int play(long s, double eps, int mode, int pf, int *len) {
  for (int ply = 0; ply < 300; ply++) {
    int side = s & 1, kind[64]; long c[64]; int n = succ(s, kind, c), pick = 0;
    int perfect = mode == 0 ? !((xr() % 10000) < eps * 10000) : side == pf;
    if (mode == 0 && !perfect) pick = xr() % n;
    else if (perfect) { int best = -1 << 30, cn = 0; for (int j = 0; j < n; j++) { int sc = mscore(kind[j], c[j]); if (sc > best) { best = sc; cn = 1; pick = j; } else if (sc == best && xr() % ++cn == 0) pick = j; } }
    else {
      int ok[64], k = 0, win = -1;
      for (int j = 0; j < n; j++) { if (kind[j] == 1) win = j; else if (kind[j] == 2) continue; else { uint16_t v = val[c[j]]; if (v == 2) continue; ok[k++] = j; } }
      pick = win >= 0 ? win : k ? ok[xr() % k] : (int)(xr() % n);
    }
    *len = ply + 1;
    if (kind[pick] == 1) return side;
    if (kind[pick] == 2) return 1 - side;
    s = c[pick];
  }
  *len = 300; return 2;
}

static uint32_t maskOfCells(int *cells, int k) { uint32_t m = 0; for (int i = 0; i < k; i++) m |= 1u << fidx[cells[i]]; return m; }
static uint32_t rotMask(uint32_t m) { uint32_t o = 0; for (int i = 0; i < N; i++) if (m >> i & 1) o |= 1u << fidx[rot(fcell[i])]; return o; }
static void cellName(int cell, char *b) { sprintf(b, "%c%d", 'a' + cell % C, R - cell / C); }
static void printStart(uint32_t mm) { char b[8]; for (int i = 0; i < N; i++) if (mm >> i & 1) { cellName(fcell[i], b); printf("%s ", b); } }

int main(int argc, char **argv) {
  int pil[64], np = 1, hr = 1, hc = 0, top = 0, minMoves = 0, home = 0, balance = 0, half = 0, perftD = 0; char *startArg = 0; const char *dump = 0;
  pil[0] = 0 * 100 + 1;   // b5 (and its twin d1)
  for (int i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "--rc")) { R = atoi(argv[++i]); C = atoi(argv[++i]); }
    else if (!strcmp(argv[i], "--k")) K = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--step")) STEP = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--ban")) BAN = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--nullt")) NULLT = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--hole")) { hr = atoi(argv[++i]); hc = atoi(argv[++i]); }
    else if (!strcmp(argv[i], "--pillars")) { np = 0; char *s = argv[++i]; while (*s) { int r, c, k; if (sscanf(s, "%d,%d%n", &r, &c, &k) < 2) break; pil[np++] = r * 100 + c; s += k; if (*s == ';') s++; } }
    else if (!strcmp(argv[i], "--top")) top = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--minmoves")) minMoves = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--home")) home = 1;
    else if (!strcmp(argv[i], "--start")) startArg = argv[++i];
    else if (!strcmp(argv[i], "--balance")) balance = 1;
    else if (!strcmp(argv[i], "--half")) half = 1;
    else if (!strcmp(argv[i], "--perft")) perftD = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--dump")) dump = argv[++i];
  }
  NCELL = R * C;
  memset(type, 0, sizeof type);
  for (int i = 0; i < np; i++) { int cell = (pil[i] / 100) * C + pil[i] % 100; type[cell] = 1; type[rot(cell)] = 1; }
  holeM = hr * C + hc; type[holeM] = 2; type[rot(holeM)] = 3;
  N = 0; for (int cell = 0; cell < NCELL; cell++) { fidx[cell] = -1; if (!type[cell]) { fidx[cell] = N; fcell[N++] = cell; } }
  for (int n = 0; n < 40; n++) { binom[n][0] = 1; for (int k = 1; k < 8; k++) binom[n][k] = n ? binom[n - 1][k - 1] + binom[n - 1][k] : 0; }
  CK = binom[N][K];
  subs = malloc(sizeof(uint32_t) * CK);
  { uint64_t m = (1ull << K) - 1; while (m < (1ull << N)) { subs[rankOf((uint32_t)m)] = (uint32_t)m; uint64_t c = m & -m, r = m + c; m = (((r ^ m) >> 2) / c) | r; } }
  build(); solve();
  // stats over states with Mint to move and no ban
  long a = 0, b2 = 0, c2 = 0;
  for (long base = 0; base < NB; base++) { if (subs[base / CK] & subs[base % CK]) continue; uint16_t v = val[sidx(base, 4, 0)]; if (!v) c2++; else if (v & 1) b2++; else a++; }
  double t = a + b2 + c2;
  // symmetric starts
  int dr = 0, fw = 0, fl = 0;
  typedef struct { uint32_t mm; int n, safe; } Row; Row *rows = malloc(sizeof(Row) * CK); int nr = 0;
  for (int r = 0; r < CK; r++) {
    uint32_t mm = subs[r], cm = rotMask(mm); if (mm & cm) continue;
    long st = startState(mm, cm); uint16_t v = val[st];
    if (!v) dr++; else if (v & 1) fl++; else fw++;
    if (v) continue;
    int kind[64]; long c[64]; int n = succ(st, kind, c), safe = 0;
    for (int j = 0; j < n; j++) if (kind[j] == 0 && (!val[c[j]] || (val[c[j]] & 1))) safe++;
    if (minMoves && (n < minMoves || safe < 2 || safe == n)) continue;
    if (half) { int bad = 0; for (int q = 0; q < N; q++) if ((mm >> q & 1) && fcell[q] / C < R - 2) bad = 1; if (bad) continue; }
    rows[nr++] = (Row){mm, n, safe};
  }
  char hb[8]; cellName(holeM, hb);
  printf("R%d C%d K%d step%d ban%d nullt%d hole %s pillars %d | win %.1f%% loss %.1f%% draw %.1f%% longest %d | sym starts: draw %d first-wins %d first-loses %d | ranked %d\n",
         R, C, K, STEP, BAN, NULLT, hb, np, 100 * a / t, 100 * b2 / t, 100 * c2 / t, longest, dr, fw, fl, nr);
  fflush(stdout);
  if (home) {
    for (int r = 0; r < CK; r++) {
      uint32_t mm = subs[r]; int allHome = 1;
      for (int i = 0; i < N; i++) if ((mm >> i & 1) && fcell[i] / C != R - 1) allHome = 0;
      if (!allHome) continue;
      uint32_t cm = rotMask(mm); if (mm & cm) continue;
      long st = startState(mm, cm); uint16_t v = val[st];
      int kind[64]; long c[64]; int n = succ(st, kind, c), safe = 0;
      for (int j = 0; j < n; j++) if (kind[j] == 0 && (!val[c[j]] || (val[c[j]] & 1))) safe++;
      printf("  home start "); printStart(mm); printf(": %s %d | %d of %d first moves hold\n", !v ? "draw" : (v & 1) ? "first loses in" : "first wins in", v ? v / 2 : 0, safe, n);
    }
  }
  if (dump) { FILE *f = fopen(dump, "wb"); fwrite(val, 2, NS, f); fclose(f); }
  if (startArg) {
    int cells[8], k = 0; char *q = startArg;
    while (*q && k < K) { int c = q[0] - 'a', r = R - atoi(q + 1); cells[k++] = r * C + c; while (*q && *q != ',') q++; if (*q) q++; }
    uint32_t mm = maskOfCells(cells, K), cm = rotMask(mm);
    long st = startState(mm, cm); uint16_t v = val[st];
    printf("start "); printStart(mm); printf("(Coral "); printStart(cm); printf("), Mint first: %s", !v ? "draw" : (v & 1) ? "loses in " : "wins in "); if (v) printf("%d", v / 2); printf("\n");
    // the moves in the order build() stores them: tilts N E S W, then each piece's steps N E S W
    static const char *DN[4] = {"N", "E", "S", "W"};
    char from[64][8], to[64][8]; int nm = 0;
    { uint32_t om, oc; for (int d = 0; d < 4; d++) if (doTilt(mm, cm, 0, d, &om, &oc)) { sprintf(from[nm], "tilt"); sprintf(to[nm], "%s", DN[d]); nm++; } }
    for (uint32_t x = mm; x; x &= x - 1) {
      int cell = fcell[__builtin_ctz(x)];
      for (int d = 0; d < 4; d++) {
        int r = cell / C + DR[d], c = cell % C + DC[d];
        if (r < 0 || r >= R || c < 0 || c >= C) continue;
        int t = type[r * C + c];
        if (t == 1 || t == 3) continue;
        if (t == 0 && (((mm | cm) >> fidx[r * C + c]) & 1)) continue;
        cellName(cell, from[nm]); cellName(r * C + c, to[nm]); nm++;
      }
    }
    int kind[64]; long ch[64]; int n = succ(st, kind, ch);
    for (int j = 0; j < n && j < nm; j++) {
      uint16_t w = kind[j] == 0 ? val[ch[j]] : 0;
      printf("  %s %s -> %s", from[j], to[j], kind[j] == 1 ? "wins at once" : kind[j] == 2 ? "loses at once" : !w ? "draw" : (w & 1) ? "Coral loses" : "Coral wins");
      if (kind[j] == 0 && w && !(w & 1)) printf(" within %d more moves", w / 2);
      printf("\n");
    }
    if (perftD) {
      for (int d = 1; d <= perftD; d++) printf("perft %d %ld\n", d, perft(st, d));
    } else {
      int w3[3] = {0, 0, 0}; long len = 0;
      for (int g = 0; g < 20000; g++) { int l; w3[play(st, 0.1, 0, 0, &l)]++; len += l; }
      printf("  10%% slips: first %.1f%% second %.1f%% draw %.1f%%, %.0f moves on average\n", 100.0 * w3[0] / 20000, 100.0 * w3[1] / 20000, 100.0 * w3[2] / 20000, len / 20000.0);
      for (int side = 0; side < 2; side++) {
        int win = 0; long tl = 0;
        for (int g = 0; g < 4000; g++) { int l; if (play(st, 0, 1, side, &l) == side) win++; tl += l; }
        printf("  perfect play %s beats a one-move player %.1f%%, %.0f moves on average\n", side ? "second" : "first", 100.0 * win / 4000, tl / 4000.0);
      }
    }
  }
  if (top && balance) {
    double *gap = malloc(sizeof(double) * nr), sum = 0, mn = 1, mx = -1;
    for (int i = 0; i < nr; i++) {
      long st = startState(rows[i].mm, rotMask(rows[i].mm)); int w[3] = {0, 0, 0};
      for (int q = 0; q < 4000; q++) { int l; w[play(st, 0.1, 0, 0, &l)]++; }
      gap[i] = (w[0] - w[1]) / 4000.0; sum += gap[i]; if (gap[i] < mn) mn = gap[i]; if (gap[i] > mx) mx = gap[i];
    }
    for (int i = 0; i < nr; i++) for (int j = i + 1; j < nr; j++) {
      double gi = gap[i] < 0 ? -gap[i] : gap[i], gj = gap[j] < 0 ? -gap[j] : gap[j];
      if (gj < gi) { Row x = rows[i]; rows[i] = rows[j]; rows[j] = x; double t2 = gap[i]; gap[i] = gap[j]; gap[j] = t2; }
    }
    printf("  first-minus-second over %d ranked starts: mean %.1f points, range %.1f to %.1f\n", nr, 100 * sum / nr, 100 * mn, 100 * mx);
  } else if (top) {
    for (int i = 0; i < nr; i++) for (int j = i + 1; j < nr; j++) {
      int better = rows[j].n > rows[i].n || (rows[j].n == rows[i].n && rows[j].safe < rows[i].safe);
      if (better) { Row x = rows[i]; rows[i] = rows[j]; rows[j] = x; }
    }
  }
  if (top) {
    for (int i = 0; i < nr && i < top; i++) {
      uint32_t mm = rows[i].mm, cm = rotMask(mm); long st = startState(mm, cm);
      int w[3]; long len; double s1[4], pf[2], pl = 0;
      for (int e = 0; e < 1; e++) {
        w[0] = w[1] = w[2] = 0; len = 0;
        for (int g = 0; g < 20000; g++) { int l; int res = play(st, 0.1, 0, 0, &l); w[res]++; len += l; }
        s1[0] = 100.0 * w[0] / 20000; s1[1] = 100.0 * w[1] / 20000; s1[2] = 100.0 * w[2] / 20000; s1[3] = len / 20000.0;
      }
      for (int side = 0; side < 2; side++) { int win = 0; long tl = 0; for (int g = 0; g < 4000; g++) { int l; int res = play(st, 0, 1, side, &l); if (res == side) win++; tl += l; } pf[side] = 100.0 * win / 4000; pl += tl / 8000.0; }
      printf("  start "); printStart(mm); printf("| %d of %d first moves hold | 10%% slips %.1f/%.1f/%.1f len %.0f | perfect beats 1-ply %.1f%% first, %.1f%% second (len %.0f)\n",
             rows[i].safe, rows[i].n, s1[0], s1[1], s1[2], s1[3], pf[0], pf[1], pl);
    }
  }
  return 0;
}
