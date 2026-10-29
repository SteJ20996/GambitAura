// Retrograde solver for 轉環 Zhuanhuan (GambitAura Game 02).
// Board: 3 rings x 8 spots; spot s = ring*8 + ray (ring 0 inner, 2 outer; ray 0..7 = spoke a..h).
// Each side has 3 pieces. A turn: turn one ring one step (every piece on it rides along), or step
// one own piece to an empty neighbour (along its ring, or along its spoke to the next ring).
// Win: three own pieces on one spoke, or (with --arc 1) three side by side on one ring. A move that
// lines up only the other side loses; one that lines up both wins for the mover.
// State = (mover pieces, other pieces, last turn) with the mover to move. The rules are the same for
// both sides, so one table of 2024 x 1330 x 7 = 18,843,440 states covers both colours.
//
// The defaults are the shipped rules: --arc 1 --rot 1 --ban 1. The design record (README in this
// folder and index.html) compares the variants:
//   --arc 0  spoke lines only: no position is a forced win beyond one move; turning always defends.
//   --rot 0  any ring may be turned; --rot 1 only a ring carrying one of your pieces; --rot 2 any
//            ring with a piece on it.
//   --ban 0  a ring may be turned straight back at once.
//
// Build: gcc -O3 -march=native -fopenmp -o solver solver.c
// Use:   ./solver --show d1,e2,f3 h1,a2,b3          value and every first move of the opening
//        ./solver --openings                         every half-turn symmetric opening, one per class
//        ./solver --many file                        openings from a file, with simulated games
//        ./solver --perft d1,e2,f3 h1,a2,b3 6        move-tree counts (no solve); must match engine.js
//        ./solver --dump table.bin                   raw table for check_table.mjs and probe_ai.mjs
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <immintrin.h>
#include <omp.h>

static int ROT = 1;          // 0: any ring, 1: a ring with one of your pieces, 2: a ring with any piece
static int BAN = 1;          // 1: the ring just turned cannot be turned straight back next move
static int ARC = 1;          // 1: three in a row along one ring also wins
static int L;                // size of the "last turn" dimension
static uint32_t C24[2024], C21[1330];
static uint16_t *R24, *R21;
static uint16_t *val;
static long N;
#define FULL 0xFFFFFFu

static inline uint32_t rl(uint32_t f, int k) { return ((f << k) | (f >> (8 - k))) & 0xFF; }
static inline int line(uint32_t m) {
  if (m & (m >> 8) & (m >> 16) & 0xFF) return 1;
  if (ARC) for (int r = 0; r < 3; r++) { uint32_t f = (m >> (8 * r)) & 0xFF; if (f & rl(f, 1) & rl(f, 2)) return 1; }
  return 0;
}
static inline uint32_t rot(uint32_t m, int r, int d) {
  uint32_t f = (m >> (8 * r)) & 0xFF;
  f = d > 0 ? ((f << 1) | (f >> 7)) & 0xFF : ((f >> 1) | (f << 7)) & 0xFF;
  return (m & ~(0xFFu << (8 * r))) | (f << (8 * r));
}
static inline long idx(uint32_t M, uint32_t O, int last) {
  return ((long)R24[M] * 1330 + R21[_pext_u32(O, ~M & FULL)]) * L + last;
}
static inline void decode(long i, uint32_t *M, uint32_t *O, int *last) {
  *last = i % L; long r = i / L;
  *M = C24[r / 1330];
  *O = _pdep_u32(C21[r % 1330], ~*M & FULL);
}
static int nbr[24][4], nn[24];
static void init(void) {
  L = BAN ? 7 : 1;
  int k;
  R24 = calloc(1u << 24, 2); R21 = calloc(1u << 21, 2);
  // colex ranks
  k = 0;
  for (int c = 2; c < 24; c++) for (int b = 1; b < c; b++) for (int a = 0; a < b; a++) {
    uint32_t m = (1u << a) | (1u << b) | (1u << c);
    R24[m] = k; C24[k++] = m;
  }
  k = 0;
  for (int c = 2; c < 21; c++) for (int b = 1; b < c; b++) for (int a = 0; a < b; a++) {
    uint32_t m = (1u << a) | (1u << b) | (1u << c);
    R21[m] = k; C21[k++] = m;
  }
  for (int s = 0; s < 24; s++) {
    int r = s / 8, q = s % 8; nn[s] = 0;
    nbr[s][nn[s]++] = r * 8 + (q + 1) % 8;
    nbr[s][nn[s]++] = r * 8 + (q + 7) % 8;
    if (r > 0) nbr[s][nn[s]++] = s - 8;
    if (r < 2) nbr[s][nn[s]++] = s + 8;
  }
  N = 2024L * 1330 * L;
}

// Successors as (mover', other', last') = (O', M', last'). Returns count.
typedef struct { uint32_t M, O; int last; int kind, a, b; } Move;   // kind 0 turn (a ring, b dir), 1 step (a from, b to)
static int gen(uint32_t M, uint32_t O, int last, Move *mv) {
  int n = 0;
  for (int r = 0; r < 3; r++) {
    uint32_t ring = 0xFFu << (8 * r);
    if (ROT == 1 && !(M & ring)) continue;
    if (ROT == 2 && !((M | O) & ring)) continue;
    for (int d = -1; d <= 1; d += 2) {
      if (BAN && last == 1 + r * 2 + (d < 0 ? 1 : 0)) continue;   // straight back: other side turned r by -d
      Move m = { rot(O, r, d), rot(M, r, d), BAN ? 1 + r * 2 + (d > 0 ? 1 : 0) : 0, 0, r, d };
      mv[n++] = m;
    }
  }
  uint32_t occ = M | O;
  for (uint32_t x = M; x; x &= x - 1) {
    int s = __builtin_ctz(x);
    for (int j = 0; j < nn[s]; j++) {
      int t = nbr[s][j];
      if (occ >> t & 1) continue;
      Move m = { O, M ^ (1u << s) ^ (1u << t), 0, 1, s, t };
      mv[n++] = m;
    }
  }
  return n;
}

static void solve(void) {
  val = calloc(N, 2);
  long term = 0;
#pragma omp parallel for reduction(+:term) schedule(static)
  for (long i = 0; i < N; i++) {
    uint32_t M, O; int last; decode(i, &M, &O, &last);
    if (line(O)) { val[i] = 1; term++; }
    else if (line(M)) { val[i] = 2; term++; }
  }
  fprintf(stderr, "terminal %ld of %ld\n", term, N);
  int idle = 0;
  for (int p = 1; idle < 2; p++) {
    long changed = 0;
    const int odd = p & 1;
    const uint16_t lim = 2 * p;   // values with plies <= p-1
#pragma omp parallel for reduction(+:changed) schedule(dynamic, 65536)
    for (long i = 0; i < N; i++) {
      if (val[i]) continue;
      uint32_t M, O; int last; decode(i, &M, &O, &last);
      Move mv[24]; int n = gen(M, O, last, mv);
      if (odd) {
        for (int j = 0; j < n; j++) {
          uint16_t v = val[idx(mv[j].M, mv[j].O, mv[j].last)];
          if (v && (v & 1) && v <= lim) { val[i] = 2 * p + 2; changed++; break; }
        }
      } else {
        int all = 1;
        for (int j = 0; j < n && all; j++) {
          uint16_t v = val[idx(mv[j].M, mv[j].O, mv[j].last)];
          if (!(v && !(v & 1) && v <= lim)) all = 0;
        }
        if (all) { val[i] = 2 * p + 1; changed++; }
      }
    }
    if (changed) { idle = 0; fprintf(stderr, "pass %d: %ld\n", p, changed); } else idle++;
  }
}

static const char *res(uint16_t v) { return !v ? "draw" : (v & 1) ? "loss" : "win"; }
static int plies(uint16_t v) { return v ? (v - 1) / 2 : -1; }
static void name(int s, char *b) { b[0] = 'a' + s % 8; b[1] = '1' + s / 8; b[2] = 0; }   // ray letter, ring number

// Geometry helpers for openings: rotate the whole board by k rays, reflect rays.
static uint32_t spin(uint32_t m, int k) { for (int r = 0; r < 3; r++) for (int i = 0; i < k; i++) m = rot(m, r, 1); return m; }
static uint32_t flip(uint32_t m) {
  uint32_t o = 0;
  for (int s = 0; s < 24; s++) if (m >> s & 1) { int r = s / 8, q = s % 8; o |= 1u << (r * 8 + (8 - q) % 8); }
  return o;
}

// Value of a move list from (M,O) with the mover to move.
static void show(uint32_t M, uint32_t O, int last) {
  uint16_t v = val[idx(M, O, last)];
  printf("value for the side to move: %s in %d\n", res(v), plies(v));
  Move mv[24]; int n = gen(M, O, last, mv);
  for (int j = 0; j < n; j++) {
    uint16_t w = val[idx(mv[j].M, mv[j].O, mv[j].last)];
    char a[8], b[8];
    if (mv[j].kind == 0) printf("  turn ring %d %s", mv[j].a + 1, mv[j].b > 0 ? "+" : "-");
    else { name(mv[j].a, a); name(mv[j].b, b); printf("  step %s-%s", a, b); }
    printf(" -> opponent %s in %d\n", res(w), plies(w));
  }
}

// Random-slip self-play: each side picks a best move with prob 1-eps, a random move otherwise.
static uint64_t rng = 88172645463325252ull;
static inline uint64_t xr(void) { rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17; return rng; }
static int score(uint16_t w) {   // score of a successor for the mover (higher better)
  if (!w) return 0;
  return (w & 1) ? 1000 - plies(w) : -1000 + plies(w);   // opponent loses: good; quick is better
}
static void sim(uint32_t M, uint32_t O, int games, double eps) {
  int wins[3] = {0, 0, 0}; long len = 0, dlen = 0, dn = 0;
  for (int g = 0; g < games; g++) {
    uint32_t a = M, b = O; int last = 0, side = 0, ply = 0, result = 2;
    // repetition: crude, stop at 300 plies as a draw
    while (ply < 300) {
      uint16_t v = val[idx(a, b, last)];
      if (v == 1) { result = 1 - side; break; }
      if (v == 2) { result = side; break; }
      Move mv[24]; int n = gen(a, b, last, mv), pick = 0;
      if ((xr() % 10000) < eps * 10000) pick = xr() % n;
      else {
        int best = -100000, cnt = 0;
        for (int j = 0; j < n; j++) {
          int s = score(val[idx(mv[j].M, mv[j].O, mv[j].last)]);
          if (s > best) { best = s; cnt = 1; pick = j; } else if (s == best && xr() % ++cnt == 0) pick = j;
        }
      }
      a = mv[pick].M; b = mv[pick].O; last = mv[pick].last; side ^= 1; ply++;
    }
    wins[result]++; len += ply; if (result != 2) { dlen += ply; dn++; }
  }
  printf("eps %.2f: first %.1f%%  second %.1f%%  draw %.1f%%  mean length %.1f  decisive length %.1f\n",
         eps, 100.0 * wins[0] / games, 100.0 * wins[1] / games, 100.0 * wins[2] / games,
         (double)len / games, dn ? (double)dlen / dn : 0);
}

// Perfect player vs a shallow player who takes a win in one, avoids handing over a win in one,
// and otherwise moves at random. Shows how much the deeper tactics matter.
static int pick_perfect(Move *mv, int n) {
  int best = -100000, cnt = 0, pick = 0;
  for (int j = 0; j < n; j++) {
    int s = score(val[idx(mv[j].M, mv[j].O, mv[j].last)]);
    if (s > best) { best = s; cnt = 1; pick = j; } else if (s == best && xr() % ++cnt == 0) pick = j;
  }
  return pick;
}
static int pick_shallow(Move *mv, int n) {
  int ok[24], k = 0;
  for (int j = 0; j < n; j++) { uint16_t w = val[idx(mv[j].M, mv[j].O, mv[j].last)]; if (w == 1) return j; }
  for (int j = 0; j < n; j++) { uint16_t w = val[idx(mv[j].M, mv[j].O, mv[j].last)]; if (w != 2 && w != 4) ok[k++] = j; }
  return k ? ok[xr() % k] : (int)(xr() % n);
}
static void duel(uint32_t M, uint32_t O, int games, int perfectFirst) {
  int wins[3] = {0, 0, 0}; long dlen = 0, dn = 0;
  for (int g = 0; g < games; g++) {
    uint32_t a = M, b = O; int last = 0, side = 0, ply = 0, result = 2;
    while (ply < 400) {
      uint16_t v = val[idx(a, b, last)];
      if (v == 1) { result = 1 - side; break; }
      if (v == 2) { result = side; break; }
      Move mv[24]; int n = gen(a, b, last, mv);
      int perfect = (side == 0) == perfectFirst;
      int pick = perfect ? pick_perfect(mv, n) : pick_shallow(mv, n);
      a = mv[pick].M; b = mv[pick].O; last = mv[pick].last; side ^= 1; ply++;
    }
    wins[result]++; if (result != 2) { dlen += ply; dn++; }
  }
  int pw = perfectFirst ? wins[0] : wins[1], sw = perfectFirst ? wins[1] : wins[0];
  printf("perfect %s vs one-move-lookahead: perfect wins %.1f%%, shallow wins %.1f%%, draw %.1f%%, decisive length %.1f\n",
         perfectFirst ? "first" : "second", 100.0 * pw / games, 100.0 * sw / games, 100.0 * wins[2] / games, dn ? (double)dlen / dn : 0);
}

static long perft(uint32_t M, uint32_t O, int last, int d) {
  if (line(M) || line(O) || d == 0) return 1;
  Move mv[24]; int n = gen(M, O, last, mv); long t = 0;
  for (int j = 0; j < n; j++) t += perft(mv[j].M, mv[j].O, mv[j].last, d - 1);
  return t;
}

static uint32_t parse(const char *s) {   // e.g. "a3,c3,e3"
  uint32_t m = 0;
  while (*s) { int q = s[0] - 'a', r = s[1] - '1'; m |= 1u << (r * 8 + q); s += 2; if (*s == ',') s++; }
  return m;
}

int main(int argc, char **argv) {
  for (int i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "--rot")) ROT = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--ban")) BAN = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--arc")) ARC = atoi(argv[++i]);
  }
  init();
  for (int i = 1; i < argc; i++) if (!strcmp(argv[i], "--perft")) {   // --perft MINT CORAL DEPTH, no solve
    uint32_t M = parse(argv[i + 1]), O = parse(argv[i + 2]); int d = atoi(argv[i + 3]);
    for (int k = 1; k <= d; k++) printf("%d %ld\n", k, perft(M, O, 0, k));
    return 0;
  }
  fprintf(stderr, "rot %d ban %d states %ld\n", ROT, BAN, N);
  solve();
  // overall statistics over non-terminal states with no ban pending
  long w = 0, l = 0, d = 0; int maxp = 0;
  for (long i = 0; i < N; i += L) {
    uint16_t v = val[i];
    if (v == 1 || v == 2) continue;
    if (!v) d++; else if (v & 1) l++; else w++;
    if (plies(v) > maxp) maxp = plies(v);
  }
  printf("arc %d rot %d ban %d: non-terminal states: win %.1f%%  loss %.1f%%  draw %.1f%%  longest %d plies\n",
         ARC, ROT, BAN, 100.0 * w / (w + l + d), 100.0 * l / (w + l + d), 100.0 * d / (w + l + d), maxp);
  for (int i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "--show")) {   // --show MINT CORAL  (mint to move)
      uint32_t M = parse(argv[i + 1]), O = parse(argv[i + 2]); i += 2;
      show(M, O, 0);
    } else if (!strcmp(argv[i], "--dump")) {   // raw uint16 table in index order
      FILE *f = fopen(argv[++i], "wb"); fwrite(val, 2, N, f); fclose(f);
    } else if (!strcmp(argv[i], "--many")) {   // --many file: lines "MINT CORAL"
      FILE *f = fopen(argv[++i], "r"); char a[64], b[64];
      while (f && fscanf(f, "%63s %63s", a, b) == 2) {
        uint32_t M = parse(a), O = parse(b);
        uint16_t v = val[idx(M, O, 0)];
        Move mv[24]; int n = gen(M, O, 0, mv), safe = 0;
        for (int j = 0; j < n; j++) { uint16_t x = val[idx(mv[j].M, mv[j].O, mv[j].last)]; if (!x || (x & 1)) safe++; }
        printf("%s vs %s: first %s, %d of %d first moves hold\n", a, b, res(v), safe, n);
        sim(M, O, 20000, 0.1); sim(M, O, 20000, 0.2);
        duel(M, O, 4000, 1); duel(M, O, 4000, 0);
      }
    } else if (!strcmp(argv[i], "--sim")) {
      uint32_t M = parse(argv[i + 1]), O = parse(argv[i + 2]); i += 2;
      for (double e = 0.05; e < 0.31; e += 0.1) sim(M, O, 20000, e);
    } else if (!strcmp(argv[i], "--openings")) {
      // Openings where Coral is Mint turned half way round (a fair-looking start), no line yet,
      // one per symmetry class. Prints the first player's result.
      static char seen[2024];
      int cnt[3] = {0, 0, 0};
      for (int k = 0; k < 2024; k++) {
        uint32_t M = C24[k], O = spin(M, 4);
        if (M & O || line(M) || line(O)) continue;
        int canon = k;
        for (int t = 0; t < 8; t++) for (int f = 0; f < 2; f++) {
          uint32_t x = spin(f ? flip(M) : M, t);
          if (R24[x] < canon) canon = R24[x];
        }
        if (seen[canon]) continue;
        seen[canon] = 1;
        uint16_t v = val[idx(M, O, 0)];
        int c = !v ? 2 : (v & 1) ? 1 : 0; cnt[c]++;
        // how many first moves keep at least a draw
        Move mv[24]; int n = gen(M, O, 0, mv), safe = 0;
        for (int j = 0; j < n; j++) { uint16_t x = val[idx(mv[j].M, mv[j].O, mv[j].last)]; if (!x || (x & 1)) safe++; }
        char a[8], b[8], c3[8], e[8], f2[8], g[8];
        int s[3], o[3], q = 0;
        for (uint32_t x = M; x; x &= x - 1) s[q++] = __builtin_ctz(x);
        q = 0; for (uint32_t x = O; x; x &= x - 1) o[q++] = __builtin_ctz(x);
        name(s[0], a); name(s[1], b); name(s[2], c3); name(o[0], e); name(o[1], f2); name(o[2], g);
        printf("%s,%s,%s vs %s,%s,%s: first %s in %d, %d of %d first moves keep a draw or better\n",
               a, b, c3, e, f2, g, res(v), plies(v), safe, n);
      }
      printf("classes: first wins %d, first loses %d, draw %d\n", cnt[0], cnt[1], cnt[2]);
    }
  }
  return 0;
}
