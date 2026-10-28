// Retrograde solver for Jielu (借路), 5x5, rules v0.4.
// Solves every position with four water squares, so any starting layout can be read off.
//
// Build:  gcc -O3 -march=native -fopenmp -o solver solver.c
// Modes:  solve FILE          full solve, writes the 3.7 GB table (about 4 min on 4 cores, 4 GB RAM)
//         check N             N random states: predecessors and moves mirror each other
//         perft N             leaf counts from the v0.4 start (cross-check with engine.js)
//         dump G P            G random games of up to P plies with every move list (V05=1: v0.5 start)
//         analyze FILE        start values, first moves, main line, layout scan
//         strategy FILE OUT   Coral's winning strategy tree from the v0.4 start
//         survey FILE         every fully symmetric setup: value and sharpness
//         sim FILE            equal-skill noisy play on five layouts
//         probe FILE N        test positions for the computer player (ai.js)
//         banpass FILE        looks for positions where the reversal ban forces a pass
//         query FILE          stdin: "h1 h2 h3 h4 m1 m2 c1 c2 m|c" -> value and every move
//
// Cells: idx = row*5 + col, row 0..4 = ranks 1..5, col 0..4 = files A..E.
// Mint (side 0) goal C1 = 2; Coral (side 1) goal C5 = 22.
// State = terrain (4 holes among 23 non-flag cells) x mint pair x coral pair
//         x side to move x ko slot (0 = no relevant ban, 1..8 = see slot_info).
// The "no immediate reversal" ban only bites when the last floor move was
// diagonal around a 2x2 square whose fourth corner holds a piece of the side
// to move, so it is stored only in that case (exact, not an approximation).
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <omp.h>
#include <time.h>
#include <sys/mman.h>
#include <fcntl.h>
#include <unistd.h>

#define NC 25
static const int GOAL[2] = {2, 22};
static const int OPP[2] = {22, 2};
#define FLAGS ((1u << 2) | (1u << 22))
#define ALL25 ((1u << 25) - 1)
#define NT 8855
#define NPM 171
#define NPC 136
#define NSLOT 9
#define NBASE ((uint64_t)NT * NPM * NPC)
#define NSTATE (NBASE * 2 * NSLOT)

#define INVALID 0xFF
#define WINC(d) ((uint8_t)(15 + (d)))    /* d = 1..120 */
#define LOSSC(d) ((uint8_t)(135 + (d)))  /* d = 1..119 */
#define MAXW 120
#define MAXL 119

static int nbr[NC][4], nnb[NC];
static uint32_t terrHoles[NT], mReach[NT], cReach[NT];
static uint8_t fcell[NT][19];
static int16_t *tIdx;
static uint8_t pr1[171], pr2[171];
static uint8_t *V;
static volatile int overflow = 0;

typedef struct { uint32_t holes; int pc[2][2]; int side; int slot; } St;

static uint32_t reach(uint32_t fl, int src, int excl) {
  uint32_t seen = 1u << src;
  int st[32], sp = 0; st[sp++] = src;
  while (sp) {
    int c = st[--sp];
    for (int i = 0; i < nnb[c]; i++) {
      int x = nbr[c][i];
      if (x == excl || !((fl >> x) & 1) || ((seen >> x) & 1)) continue;
      seen |= 1u << x; st[sp++] = x;
    }
  }
  return seen;
}

static void init_tables(void) {
  for (int c = 0; c < NC; c++) {
    int r = c / 5, k = c % 5; nnb[c] = 0;
    if (r > 0) nbr[c][nnb[c]++] = c - 5;
    if (r < 4) nbr[c][nnb[c]++] = c + 5;
    if (k > 0) nbr[c][nnb[c]++] = c - 1;
    if (k < 4) nbr[c][nnb[c]++] = c + 1;
  }
  int nf[23], n = 0;
  for (int c = 0; c < NC; c++) if (c != 2 && c != 22) nf[n++] = c;
  tIdx = malloc(sizeof(int16_t) << 25);
  memset(tIdx, 0xff, sizeof(int16_t) << 25);
  int t = 0;
  for (int a = 0; a < 23; a++) for (int b = a + 1; b < 23; b++)
  for (int c = b + 1; c < 23; c++) for (int d = c + 1; d < 23; d++) {
    uint32_t h = (1u << nf[a]) | (1u << nf[b]) | (1u << nf[c]) | (1u << nf[d]);
    terrHoles[t] = h; tIdx[h] = (int16_t)t;
    uint32_t fl = ALL25 & ~h;
    int m = 0;
    for (int x = 0; x < NC; x++) if (((fl >> x) & 1) && x != 2 && x != 22) fcell[t][m++] = (uint8_t)x;
    mReach[t] = reach(fl, 2, 22);
    cReach[t] = reach(fl, 22, 2);
    t++;
  }
  int p = 0;
  for (int r2 = 1; r2 < 19; r2++) for (int r1 = 0; r1 < r2; r1++) { pr1[p] = r1; pr2[p] = r2; p++; }
}

static inline void decode(uint64_t idx, St *s) {
  s->slot = (int)(idx % 9); idx /= 9;
  s->side = (int)(idx & 1); idx >>= 1;
  int ci = (int)(idx % 136); idx /= 136;
  int mi = (int)(idx % 171); int t = (int)(idx / 171);
  s->holes = terrHoles[t];
  int r1 = pr1[mi], r2 = pr2[mi];
  s->pc[0][0] = fcell[t][r1]; s->pc[0][1] = fcell[t][r2];
  int a = pr1[ci], b = pr2[ci];
  if (a >= r1) a++; if (a >= r2) a++;
  if (b >= r1) b++; if (b >= r2) b++;
  s->pc[1][0] = fcell[t][a]; s->pc[1][1] = fcell[t][b];
}

static inline uint64_t encode(uint32_t holes, int m0, int m1, int c0, int c1, int side, int slot) {
  if (m0 > m1) { int x = m0; m0 = m1; m1 = x; }
  if (c0 > c1) { int x = c0; c0 = c1; c1 = x; }
  int t = tIdx[holes];
  uint32_t fnf = ~holes & ALL25 & ~FLAGS;
  int r1 = __builtin_popcount(fnf & ((1u << m0) - 1));
  int r2 = __builtin_popcount(fnf & ((1u << m1) - 1));
  int s1 = __builtin_popcount(fnf & ((1u << c0) - 1));
  int s2 = __builtin_popcount(fnf & ((1u << c1) - 1));
  s1 -= (r1 < s1) + (r2 < s1);
  s2 -= (r1 < s2) + (r2 < s2);
  uint64_t b = ((uint64_t)t * 171 + (r2 * (r2 - 1) / 2 + r1)) * 136 + (s2 * (s2 - 1) / 2 + s1);
  return (b * 2 + side) * 9 + slot;
}

static inline uint64_t enc(const St *s, uint32_t holes, int side, int slot) {
  return encode(holes, s->pc[0][0], s->pc[0][1], s->pc[1][0], s->pc[1][1], side, slot);
}

static const int DR[4] = {-1, -1, 1, 1}, DC[4] = {-1, 1, -1, 1};

static inline uint32_t occmask(const St *s) {
  return (1u << s->pc[0][0]) | (1u << s->pc[0][1]) | (1u << s->pc[1][0]) | (1u << s->pc[1][1]);
}

// Slot k>0: piece qi of side-to-move sits at q; previous mover's piece at p = q+diag(d);
// the other two corners of that 2x2 are X (hole) and Y (empty floor). Banned: Y -> X.
static inline int slot_info(const St *s, int slot, uint32_t occ, int *bs, int *bd) {
  int k = slot - 1, qi = k >> 2, d = k & 3, B = s->side, A = 1 - B;
  int q = s->pc[B][qi], qr = q / 5, qc = q % 5, pr = qr + DR[d], pcol = qc + DC[d];
  if (pr < 0 || pr > 4 || pcol < 0 || pcol > 4) return 0;
  int p = pr * 5 + pcol;
  if (p != s->pc[A][0] && p != s->pc[A][1]) return 0;
  int c1 = qr * 5 + pcol, c2 = pr * 5 + qc;
  int h1 = (s->holes >> c1) & 1, h2 = (s->holes >> c2) & 1;
  if (h1 == h2) return 0;
  int X = h1 ? c1 : c2, Y = h1 ? c2 : c1;
  if (Y == 2 || Y == 22) return 0;
  if ((occ >> Y) & 1) return 0;
  *bs = Y; *bd = X; return 1;
}

static inline int slot_valid(const St *s, int slot) {
  if (!slot) return 1;
  int bs, bd; return slot_info(s, slot, occmask(s), &bs, &bd);
}

// Slot the opponent (B) gets after A moves floor src -> dst. Pieces unchanged.
static inline int slot_after(const St *s, int A, int src, int dst) {
  int sr = src / 5, sc = src % 5, dr = dst / 5, dc = dst % 5;
  if (abs(sr - dr) != 1 || abs(sc - dc) != 1) return 0;
  int B = 1 - A;
  int c1 = sr * 5 + dc, c2 = dr * 5 + sc;
  int a1 = (c1 == s->pc[A][0] || c1 == s->pc[A][1]);
  int a2 = (c2 == s->pc[A][0] || c2 == s->pc[A][1]);
  int b1 = (c1 == s->pc[B][0] || c1 == s->pc[B][1]);
  int b2 = (c2 == s->pc[B][0] || c2 == s->pc[B][1]);
  int q, p;
  if (a1 && b2) { p = c1; q = c2; }
  else if (a2 && b1) { p = c2; q = c1; }
  else return 0;
  int d = ((p / 5 > q / 5) ? 2 : 0) + ((p % 5 > q % 5) ? 1 : 0);
  int qi = (q == s->pc[B][0]) ? 0 : 1;
  return 1 + qi * 4 + d;
}

// Forward generation. Returns -1 if side to move wins at once, -2 if slot invalid,
// otherwise the number of successors (>=1; a forced pass counts as one).
static int gen(const St *s, uint64_t *out, int *passed) {
  int A = s->side, B = 1 - A;
  uint32_t holes = s->holes, fl = ALL25 & ~holes;
  uint32_t mM = (1u << s->pc[0][0]) | (1u << s->pc[0][1]);
  uint32_t mC = (1u << s->pc[1][0]) | (1u << s->pc[1][1]);
  uint32_t occ = mM | mC;
  int bs = -1, bd = -1;
  if (s->slot && !slot_info(s, s->slot, occ, &bs, &bd)) return -2;
  int n = 0;
  if (passed) *passed = 0;
  for (int i = 0; i < 2; i++) {
    int p = s->pc[A][i], o = s->pc[A][1 - i];
    for (int j = 0; j < nnb[p]; j++) {
      int x = nbr[p][j];
      if (!((fl >> x) & 1) || ((occ >> x) & 1) || x == OPP[A]) continue;
      if (x == GOAL[A]) return -1;
      if (out) {
        if (A == 0) out[n] = encode(holes, x, o, s->pc[1][0], s->pc[1][1], B, 0);
        else out[n] = encode(holes, s->pc[0][0], s->pc[0][1], x, o, B, 0);
      }
      n++;
    }
  }
  int seen[16], ns = 0;
  for (int i = 0; i < 2; i++) {
    int p = s->pc[A][i];
    for (int j = 0; j < nnb[p]; j++) {
      int src = nbr[p][j];
      if (!((fl >> src) & 1) || ((occ >> src) & 1) || src == 2 || src == 22) continue;
      for (int k = 0; k < nnb[p]; k++) {
        int dst = nbr[p][k];
        if (!((holes >> dst) & 1)) continue;
        int key = src * 25 + dst, dup = 0;
        for (int z = 0; z < ns; z++) if (seen[z] == key) { dup = 1; break; }
        if (dup) continue;
        seen[ns++] = key;
        if (src == bs && dst == bd) continue;
        uint32_t nh = (holes & ~(1u << dst)) | (1u << src);
        int t2 = tIdx[nh];
        if (!(mM & mReach[t2]) || !(mC & cReach[t2])) continue;
        if (out) out[n] = enc(s, nh, B, slot_after(s, A, src, dst));
        n++;
      }
    }
  }
  if (n == 0) {
    if (out) out[0] = enc(s, holes, B, 0);
    if (passed) *passed = 1;
    n = 1;
  }
  return n;
}

// Predecessors of s (states whose move leads to s). Must mirror gen() exactly.
static int preds(const St *s, uint64_t *out) {
  int B = s->side, A = 1 - B;
  uint32_t holes = s->holes, fl = ALL25 & ~holes;
  uint32_t mM = (1u << s->pc[0][0]) | (1u << s->pc[0][1]);
  uint32_t mC = (1u << s->pc[1][0]) | (1u << s->pc[1][1]);
  uint32_t occ = mM | mC;
  int conn = (mM & mReach[tIdx[holes]]) && (mC & cReach[tIdx[holes]]);
  int n = 0;
  St sp;
  if (s->slot == 0) {
    // walks by A
    for (int i = 0; i < 2; i++) {
      int b = s->pc[A][i], o = s->pc[A][1 - i];
      for (int j = 0; j < nnb[b]; j++) {
        int a = nbr[b][j];
        if (!((fl >> a) & 1) || ((occ >> a) & 1) || a == 2 || a == 22) continue;
        sp = *s; sp.side = A;
        sp.pc[A][0] = a < o ? a : o; sp.pc[A][1] = a < o ? o : a;
        for (int k = 0; k < NSLOT; k++) {
          if (!slot_valid(&sp, k)) continue;
          out[n++] = enc(&sp, holes, A, k);
        }
      }
    }
    // forced pass by A
    sp = *s; sp.side = A;
    for (int k = 0; k < NSLOT; k++) {
      sp.slot = k;
      if (!slot_valid(&sp, k)) continue;
      int passed;
      gen(&sp, NULL, &passed);
      if (passed) out[n++] = enc(&sp, holes, A, k);
    }
    // floor moves by A that leave no relevant ban
    if (conn) {
      int seen[16], ns = 0;
      for (int i = 0; i < 2; i++) {
        int p = s->pc[A][i];
        for (int j = 0; j < nnb[p]; j++) {
          int Y = nbr[p][j];
          if (!((fl >> Y) & 1) || ((occ >> Y) & 1) || Y == 2 || Y == 22) continue;
          for (int k = 0; k < nnb[p]; k++) {
            int X = nbr[p][k];
            if (!((holes >> X) & 1)) continue;
            int key = X * 25 + Y, dup = 0;
            for (int z = 0; z < ns; z++) if (seen[z] == key) { dup = 1; break; }
            if (dup) continue;
            seen[ns++] = key;
            uint32_t ph = (holes & ~(1u << X)) | (1u << Y);
            sp = *s; sp.side = A; sp.holes = ph;
            if (slot_after(&sp, A, X, Y) != 0) continue;
            uint32_t pocc = occ;
            for (int kk = 0; kk < NSLOT; kk++) {
              if (kk) {
                int bs, bd;
                if (!slot_info(&sp, kk, pocc, &bs, &bd)) continue;
                if (bs == X && bd == Y) continue;
              }
              out[n++] = enc(&sp, ph, A, kk);
            }
          }
        }
      }
    }
  } else {
    int bs, bd;
    if (!slot_info(s, s->slot, occ, &bs, &bd)) return 0;
    if (!conn) return 0;
    int X = bd, Y = bs;  // A moved X -> Y
    uint32_t ph = (holes & ~(1u << X)) | (1u << Y);
    sp = *s; sp.side = A; sp.holes = ph;
    for (int kk = 0; kk < NSLOT; kk++) {
      if (kk) {
        int b2, d2;
        if (!slot_info(&sp, kk, occ, &b2, &d2)) continue;
        if (b2 == X && d2 == Y) continue;
      }
      out[n++] = enc(&sp, ph, A, kk);
    }
  }
  return n;
}

static inline void mark_win(uint64_t idx, uint8_t code) {
  uint8_t *p = &V[idx];
  uint8_t old = __atomic_load_n(p, __ATOMIC_RELAXED);
  while (old < 16) {
    if (__atomic_compare_exchange_n(p, &old, code, 0, __ATOMIC_RELAXED, __ATOMIC_RELAXED)) return;
  }
}

static inline void dec_count(uint64_t idx, uint8_t losscode) {
  uint8_t *p = &V[idx];
  uint8_t old = __atomic_load_n(p, __ATOMIC_RELAXED);
  while (old < 16) {
    uint8_t nv = (uint8_t)(old - 1);
    if (nv == 0) nv = losscode;
    if (__atomic_compare_exchange_n(p, &old, nv, 0, __ATOMIC_RELAXED, __ATOMIC_RELAXED)) return;
  }
}

static double now(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec + t.tv_nsec * 1e-9; }

static const char *valstr(uint8_t v, char *buf) {
  if (v == INVALID) return "invalid";
  if (v < 16) { sprintf(buf, "draw"); return buf; }
  if (v <= 135) { sprintf(buf, "WIN in %d", v - 15); return buf; }
  sprintf(buf, "LOSS in %d", v - 135); return buf;
}

static void solve(const char *outfile) {
  V = malloc(NSTATE);
  if (!V) { fprintf(stderr, "alloc failed\n"); exit(1); }
  double t0 = now();
  uint64_t nvalid = 0, nwin1 = 0;
  #pragma omp parallel for schedule(dynamic, 1 << 16) reduction(+:nvalid, nwin1)
  for (uint64_t idx = 0; idx < NSTATE; idx++) {
    St s; decode(idx, &s);
    int r = gen(&s, NULL, NULL);
    if (r == -2) { V[idx] = INVALID; continue; }
    nvalid++;
    if (r == -1) { V[idx] = WINC(1); nwin1++; continue; }
    if (r >= 16) { fprintf(stderr, "too many moves\n"); exit(1); }
    V[idx] = (uint8_t)r;
  }
  fprintf(stderr, "init: %llu valid states, %llu win-in-1, %.1fs\n",
          (unsigned long long)nvalid, (unsigned long long)nwin1, now() - t0);
  for (int d = 1;; d++) {
    if (d >= MAXL) { fprintf(stderr, "depth cap reached\n"); overflow = 1; break; }
    uint8_t wc = WINC(d), lc = LOSSC(d);
    uint64_t cw = 0, cl = 0;
    #pragma omp parallel for schedule(dynamic, 1 << 18) reduction(+:cw, cl)
    for (uint64_t idx = 0; idx < NSTATE; idx++) {
      uint8_t v = V[idx];
      if (v != wc && v != lc) continue;
      St s; decode(idx, &s);
      uint64_t pl[256];
      int np = preds(&s, pl);
      if (v == wc) { cw++; for (int i = 0; i < np; i++) dec_count(pl[i], LOSSC(d + 1)); }
      else { cl++; for (int i = 0; i < np; i++) mark_win(pl[i], WINC(d + 1)); }
    }
    fprintf(stderr, "depth %3d: win %llu loss %llu  (%.1fs)\n", d,
            (unsigned long long)cw, (unsigned long long)cl, now() - t0);
    if (cw == 0 && cl == 0) break;
  }
  FILE *f = fopen(outfile, "wb");
  size_t chunk = 1 << 28;
  for (uint64_t off = 0; off < NSTATE; off += chunk) {
    size_t len = (NSTATE - off < chunk) ? (size_t)(NSTATE - off) : chunk;
    fwrite(V + off, 1, len, f);
  }
  fclose(f);
  fprintf(stderr, "saved %s (%.1fs)\n", outfile, now() - t0);
}

static void load(const char *file) {
  int fd = open(file, O_RDONLY);
  if (fd < 0) { perror("open"); exit(1); }
  V = mmap(NULL, NSTATE, PROT_READ, MAP_SHARED, fd, 0);
  if (V == MAP_FAILED) { perror("mmap"); exit(1); }
}

// perft with full ko semantics (same compressed encoding), for cross-checking the JS engine
static uint64_t perft(const St *s, int depth) {
  if (depth == 0) return 1;
  uint64_t out[32]; int passed;
  int n = gen(s, out, &passed);
  if (n == -1) {
    // count winning moves as leaves; also count non-winning moves: recompute without early return
    // simpler: treat game-ending as leaf count 1 per position (documented)
    return 1;
  }
  uint64_t tot = 0;
  for (int i = 0; i < n; i++) { St c; decode(out[i], &c); tot += perft(&c, depth - 1); }
  return tot;
}


static uint64_t rng = 88172645463325252ULL;
static inline uint64_t xr(void){ rng ^= rng<<13; rng ^= rng>>7; rng ^= rng<<17; return rng; }
static void check(int trials) {
  uint64_t ok = 0, bad = 0, tested = 0;
  for (int t = 0; t < trials; t++) {
    uint64_t idx = xr() % NSTATE;
    St s; decode(idx, &s);
    if (getenv("SLOTONLY") && !s.slot) { t--; continue; }
    if (s.slot && !slot_valid(&s, s.slot)) { t--; continue; }
    // bias: half the time pick a slot state
    uint64_t out[32]; int passed;
    int n = gen(&s, out, &passed);
    if (n < 0) continue;
    tested++;
    for (int i = 0; i < n; i++) {
      St c; decode(out[i], &c);
      if (!slot_valid(&c, c.slot)) { bad++; fprintf(stderr, "succ invalid slot\n"); continue; }
      uint64_t pl[256]; int np = preds(&c, pl), cnt = 0;
      for (int j = 0; j < np; j++) if (pl[j] == idx) cnt++;
      if (cnt == 1) ok++; else { bad++; if (bad < 10) fprintf(stderr, "idx %llu succ %d: found %d times (slot %d->%d pass %d)\n", (unsigned long long)idx, i, cnt, s.slot, c.slot, passed); }
    }
    // converse: every pred lists s as a successor
    uint64_t pl[256]; int np = preds(&s, pl);
    for (int j = 0; j < np; j++) {
      St p; decode(pl[j], &p);
      int pn = gen(&p, out, &passed), cnt = 0;
      if (pn < 0) { if (pn == -2) { bad++; fprintf(stderr, "pred invalid\n"); } continue; }
      for (int i = 0; i < pn; i++) if (out[i] == idx) cnt++;
      if (cnt == 1) ok++; else { bad++; if (bad < 20) fprintf(stderr, "pred %d of %llu: listed %d times\n", j, (unsigned long long)idx, cnt); }
    }
  }
  printf("check: tested %llu states, ok %llu, bad %llu\n", (unsigned long long)tested, (unsigned long long)ok, (unsigned long long)bad);
}


// Random games; for every position print canonical sorted move list and the chosen move.
static void movedesc(const St *s, const St *c2, int passed, char *desc) {
  if (passed) { strcpy(desc, "pass"); return; }
  if (c2->holes == s->holes) {
    int A = s->side, from = -1, to = -1;
    for (int k = 0; k < 2; k++) {
      int x = s->pc[A][k]; if (x != c2->pc[A][0] && x != c2->pc[A][1]) from = x;
      int y = c2->pc[A][k]; if (y != s->pc[A][0] && y != s->pc[A][1]) to = y;
    }
    sprintf(desc, "w%d-%d", from, to);
  } else {
    int src = -1, dst = -1;
    for (int x = 0; x < 25; x++) {
      if (!((s->holes >> x) & 1) && ((c2->holes >> x) & 1)) src = x;
      if (((s->holes >> x) & 1) && !((c2->holes >> x) & 1)) dst = x;
    }
    sprintf(desc, "f%d-%d", src, dst);
  }
}
static int cmpstr(const void *a, const void *b) { return strcmp((const char *)a, (const char *)b); }
static void dumpgames(int games, int maxply) {
  for (int g = 0; g < games; g++) {
    St s; s.holes = getenv("V05") ? ((1u << 5) | (1u << 9) | (1u << 15) | (1u << 19)) : ((1u << 6) | (1u << 8) | (1u << 16) | (1u << 18));
    s.pc[0][0] = 21; s.pc[0][1] = 23; s.pc[1][0] = 1; s.pc[1][1] = 3; s.side = g & 1; s.slot = 0;
    printf("G %d\n", g & 1);
    for (int ply = 0; ply < maxply; ply++) {
      uint64_t out[32]; int passed;
      int n = gen(&s, out, &passed);
      if (n == -1) { printf("WIN\n"); break; }
      char d[32][16];
      for (int i = 0; i < n; i++) { St c; decode(out[i], &c); movedesc(&s, &c, passed, d[i]); }
      int pick = (int)(xr() % n);
      char chosen[16]; strcpy(chosen, d[pick]);
      St next; decode(out[pick], &next);
      qsort(d, n, 16, cmpstr);
      printf("M");
      for (int i = 0; i < n; i++) printf(" %s", d[i]);
      printf(" | %s\n", chosen);
      s = next;
    }
    printf("E\n");
  }
}

static int cellOf(const char *s);
static void cellName(int c, char *b);
static int cellOf(const char *s) { return (s[1] - '1') * 5 + (s[0] - 'A'); }
static void cellName(int c, char *b) { b[0] = 'A' + c % 5; b[1] = '1' + c / 5; b[2] = 0; }

static uint64_t startIdx(uint32_t holes, int m0, int m1, int c0, int c1, int side) {
  return encode(holes, m0, m1, c0, c1, side, 0);
}
static int vkind(uint8_t v) { if (v < 16) return 0; if (v <= 135) return 1; if (v == INVALID) return 3; return 2; } // 0 draw 1 win 2 loss
static void pv(uint64_t idx, int maxply) {
  St s; decode(idx, &s);
  for (int ply = 0; ply < maxply; ply++) {
    uint8_t v = V[idx];
    uint64_t out[32]; int passed; int n = gen(&s, out, &passed);
    char d[16];
    if (n == -1) { printf("  %s wins by stepping onto the flag\n", s.side ? "Coral" : "Mint"); return; }
    int best = -1; int bestScore = -100000;
    for (int i = 0; i < n; i++) {
      uint8_t cv = V[out[i]]; int k = vkind(cv), sc;
      if (vkind(v) == 1) sc = (k == 2) ? 1000 - (cv - 135) : -100000;          // win: fastest
      else if (vkind(v) == 2) sc = (k == 1) ? (cv - 15) : -100000;            // loss: slowest
      else sc = (k == 0) ? 0 : -100000;                                        // draw: stay drawn
      if (sc > bestScore) { bestScore = sc; best = i; }
    }
    St c; decode(out[best], &c); movedesc(&s, &c, passed, d);
    int a, b; char f1[3], f2[3];
    if (d[0] == 'p') printf("  %3d %s pass\n", ply + 1, s.side ? "Coral" : "Mint ");
    else { sscanf(d + 1, "%d-%d", &a, &b); cellName(a, f1); cellName(b, f2);
      printf("  %3d %s %s %s%s%s\n", ply + 1, s.side ? "Coral" : "Mint ", d[0] == 'w' ? "walk " : "floor", f1, d[0] == 'w' ? "-" : ">", f2); }
    idx = out[best]; s = c;
  }
}
static void analyze(void) {
  uint32_t H0 = (1u << 6) | (1u << 8) | (1u << 16) | (1u << 18);
  char buf[64];
  uint64_t im = startIdx(H0, 21, 23, 1, 3, 0), ic = startIdx(H0, 21, 23, 1, 3, 1);
  printf("start, Mint to move: %s\n", valstr(V[im], buf));
  printf("start, Coral to move: %s\n", valstr(V[ic], buf));
  // opening moves
  St s; decode(im, &s);
  uint64_t out[32]; int passed; int n = gen(&s, out, &passed);
  printf("Mint first moves:\n");
  for (int i = 0; i < n; i++) { St c; decode(out[i], &c); char d[16]; movedesc(&s, &c, passed, d);
    uint8_t v = V[out[i]]; printf("  %-8s -> Coral to move: %s\n", d, valstr(v, buf)); }
  printf("Principal variation (Mint first):\n"); pv(im, 80);
  // global stats over slot-0, mint to move
  uint64_t cnt[4] = {0};
  for (uint64_t b = 0; b < NBASE; b++) cnt[vkind(V[(b * 2) * 9])]++;
  printf("all slot-0 states, Mint to move: win %llu loss %llu draw %llu\n",
         (unsigned long long)cnt[1], (unsigned long long)cnt[2], (unsigned long long)cnt[0]);
  // variant scan: every 4-hole layout, same pieces, Mint first
  uint64_t vc[4] = {0}, sym[4] = {0}, sym2[4] = {0};
  int histW[128] = {0};
  printf("symmetric layouts (180-degree turn and left-right mirror) and value with Mint first:\n");
  for (int t = 0; t < NT; t++) {
    uint32_t h = terrHoles[t];
    if (h & ((1u << 21) | (1u << 23) | (1u << 1) | (1u << 3))) continue;
    uint64_t idx = startIdx(h, 21, 23, 1, 3, 0);
    int k = vkind(V[idx]); vc[k]++;
    if (k == 1) histW[V[idx] - 15]++;
    uint32_t rot = 0, mir = 0;
    for (int c = 0; c < 25; c++) if ((h >> c) & 1) { rot |= 1u << (24 - c); mir |= 1u << ((c / 5) * 5 + 4 - c % 5); }
    if (rot == h) {
      sym[k]++;
      if (mir == h) { sym2[k]++;
        printf("  holes");
        for (int c = 0; c < 25; c++) if ((h >> c) & 1) { char f[3]; cellName(c, f); printf(" %s", f); }
        printf(": %s\n", valstr(V[idx], buf));
      }
    }
  }
  printf("all layouts (pieces at start squares, Mint first): win %llu loss %llu draw %llu\n",
         (unsigned long long)vc[1], (unsigned long long)vc[2], (unsigned long long)vc[0]);
  printf("180-symmetric layouts: win %llu loss %llu draw %llu\n", (unsigned long long)sym[1], (unsigned long long)sym[2], (unsigned long long)sym[0]);
  printf("fully symmetric layouts: win %llu loss %llu draw %llu\n", (unsigned long long)sym2[1], (unsigned long long)sym2[2], (unsigned long long)sym2[0]);
  printf("win-length histogram (plies: count):");
  for (int d = 1; d < 128; d++) if (histW[d]) printf(" %d:%d", d, histW[d]);
  printf("\n");
}

// Export the winner's strategy tree: loser nodes branch on every move, winner nodes take the fastest win.
static void keystr(const St *s, char *out) {
  int bs = -1, bd = -1;
  if (s->slot) slot_info(s, s->slot, occmask(s), &bs, &bd);
  if (bs >= 0) sprintf(out, "%x|%d,%d|%d,%d|%d|%d>%d", s->holes, s->pc[0][0], s->pc[0][1], s->pc[1][0], s->pc[1][1], s->side, bs, bd);
  else sprintf(out, "%x|%d,%d|%d,%d|%d|-", s->holes, s->pc[0][0], s->pc[0][1], s->pc[1][0], s->pc[1][1], s->side);
}
static uint8_t *seenS;
static uint64_t nodesS;
static void strategy(uint64_t idx, int winner, FILE *f) {
  if (seenS[idx >> 3] & (1 << (idx & 7))) return;
  seenS[idx >> 3] |= 1 << (idx & 7);
  nodesS++;
  St s; decode(idx, &s);
  uint64_t out[32]; int passed; int n = gen(&s, out, &passed);
  char k[64], d[16];
  if (s.side == winner) {
    keystr(&s, k);
    if (n == -1) {
      int A = s.side;
      for (int i = 0; i < 2; i++) for (int j = 0; j < nnb[s.pc[A][i]]; j++) if (nbr[s.pc[A][i]][j] == GOAL[A]) { fprintf(f, "%s w%d-%d\n", k, s.pc[A][i], GOAL[A]); return; }
    }
    int best = -1, bd = 1000;
    for (int i = 0; i < n; i++) { uint8_t v = V[out[i]]; if (v >= 136 && v != INVALID && v - 135 < bd) { bd = v - 135; best = i; } }
    if (best < 0) { fprintf(stderr, "winner has no winning move!\n"); exit(1); }
    St c; decode(out[best], &c); movedesc(&s, &c, passed, d);
    fprintf(f, "%s %s\n", k, d);
    strategy(out[best], winner, f);
  } else {
    if (n == -1) { fprintf(stderr, "loser can win!\n"); exit(1); }
    for (int i = 0; i < n; i++) strategy(out[i], winner, f);
  }
}

static inline int rotc(int c) { return 24 - c; }
static inline int mirc(int c) { return (c / 5) * 5 + 4 - c % 5; }
// Sharpness of a drawn start: random walks that keep to draw-holding moves.
static void sharp(uint64_t start, int walks, int plies, double *avgFrac, double *onlyOne, double *firstKeep, int *nFirst) {
  St s0; decode(start, &s0);
  uint64_t out[32]; int passed; int n = gen(&s0, out, &passed);
  int keep = 0; for (int i = 0; i < n; i++) if (vkind(V[out[i]]) == 0) keep++;
  *firstKeep = keep; *nFirst = n;
  double sumF = 0; uint64_t cnt = 0, one = 0;
  for (int w = 0; w < walks; w++) {
    uint64_t idx = start;
    for (int p = 0; p < plies; p++) {
      St s; decode(idx, &s);
      n = gen(&s, out, &passed);
      if (n < 0) break;
      int ks[32], nk = 0;
      for (int i = 0; i < n; i++) if (vkind(V[out[i]]) == 0) ks[nk++] = i;
      if (nk == 0) break;
      sumF += (double)nk / n; cnt++; if (nk == 1) one++;
      idx = out[ks[xr() % nk]];
    }
  }
  *avgFrac = cnt ? sumF / cnt : 0; *onlyOne = cnt ? (double)one / cnt : 0;
}
static void survey(void) {
  char buf[64];
  for (int t = 0; t < NT; t++) {
    uint32_t h = terrHoles[t];
    uint32_t rot = 0, mir = 0;
    for (int c = 0; c < 25; c++) if ((h >> c) & 1) { rot |= 1u << rotc(c); mir |= 1u << mirc(c); }
    if (rot != h || mir != h) continue;
    // mint pieces: a mirror pair in rows 4-5 (or a pair in one column? keep mirror pairs), not on holes or flags
    for (int a = 15; a < 25; a++) {
      int b = mirc(a);
      if (b <= a) continue;
      if (((h >> a) & 1) || ((h >> b) & 1) || a == 22 || b == 22) continue;
      int c0 = rotc(a), c1 = rotc(b);
      uint64_t idx = encode(h, a, b, c0, c1, 0, 0);
      char line[160]; int L = sprintf(line, "holes");
      for (int c = 0; c < 25; c++) if ((h >> c) & 1) { char f[3]; cellName(c, f); L += sprintf(line + L, " %s", f); }
      char fa[3], fb[3]; cellName(a, fa); cellName(b, fb);
      L += sprintf(line + L, " | mint %s %s", fa, fb);
      uint8_t v = V[idx];
      if (vkind(v) == 0) {
        double af, oo, fk; int nf;
        sharp(idx, 400, 120, &af, &oo, &fk, &nf);
        printf("%-44s DRAW  first moves holding the draw %d/%d, draw-holding share %.2f, forced-only %.2f\n", line, (int)fk, nf, af, oo);
      } else printf("%-44s %s for the first player\n", line, valstr(v, buf));
    }
  }
}

// Equal-skill play: each move is table-best with prob 1-eps, uniformly random otherwise.
// Repetition is approximated by a 400-ply cap (counted as a draw).
static int bestMove(uint64_t idx, uint64_t *out, int n) {
  uint8_t v = V[idx]; int best = 0, bs = -1000000;
  for (int i = 0; i < n; i++) {
    uint8_t cv = V[out[i]]; int k = vkind(cv), sc;
    if (k == 2) sc = 100000 - (cv - 135);       // child lost: we win; fastest
    else if (k == 0) sc = 0;
    else sc = -100000 + (cv - 15);              // child wins: slowest loss
    (void)v;
    if (sc > bs) { bs = sc; best = i; }
  }
  return best;
}
static void simulate(uint32_t h, int a, int b, double eps, int games) {
  uint64_t start = encode(h, a, b, rotc(a), rotc(b), 0, 0);
  int w1 = 0, w2 = 0, dr = 0; long len = 0;
  for (int g = 0; g < games; g++) {
    uint64_t idx = start; int ply, res = 0;
    for (ply = 0; ply < 400; ply++) {
      St s; decode(idx, &s);
      uint64_t out[32]; int passed; int n = gen(&s, out, &passed);
      if (n == -1) { res = (ply % 2 == 0) ? 1 : 2; break; }
      double r = (double)(xr() % 1000000) / 1e6;
      int pick = (r < eps) ? (int)(xr() % n) : bestMove(idx, out, n);
      idx = out[pick];
    }
    if (res == 1) w1++; else if (res == 2) w2++; else dr++;
    len += ply;
  }
  printf("  eps %.2f: first %5.1f%%  second %5.1f%%  draw %5.1f%%  avg plies %ld\n", eps,
         100.0 * w1 / games, 100.0 * w2 / games, 100.0 * dr / games, len / games);
}

// Test positions for the JS computer player: short wins, and draws with quick traps.
static void probe(int want) {
  int gotW = 0, gotD = 0;
  while (gotW < want || gotD < want) {
    uint64_t b = xr() % NBASE; int side = (int)(xr() & 1);
    uint64_t idx = (b * 2 + side) * 9;
    St s; decode(idx, &s);
    uint8_t v = V[idx]; int k = vkind(v);
    uint64_t out[32]; int passed; int n = gen(&s, out, &passed);
    if (n < 0 || passed) continue;
    char good[400] = "", bad[400] = ""; int ng = 0, nbq = 0;
    if (k == 1 && v - 15 >= 3 && v - 15 <= 9 && gotW < want) {
      for (int i = 0; i < n; i++) if (vkind(V[out[i]]) == 2) { St c; decode(out[i], &c); char d[16]; movedesc(&s, &c, passed, d); strcat(good, d); strcat(good, ";"); ng++; }
      if (ng == n) continue;  // every move wins: not a test
      printf("W|%x|%d,%d|%d,%d|%d|%d|%s\n", s.holes, s.pc[0][0], s.pc[0][1], s.pc[1][0], s.pc[1][1], side, v - 15, good);
      gotW++;
    } else if (k == 0 && gotD < want) {
      for (int i = 0; i < n; i++) {
        St c; decode(out[i], &c); char d[16]; movedesc(&s, &c, passed, d);
        uint8_t cv = V[out[i]];
        if (vkind(cv) == 0) { strcat(good, d); strcat(good, ";"); ng++; }
        else if (vkind(cv) == 1 && cv - 15 <= 8) { strcat(bad, d); strcat(bad, ";"); nbq++; }
      }
      if (!nbq) continue;
      printf("D|%x|%d,%d|%d,%d|%d|0|%s|%s\n", s.holes, s.pc[0][0], s.pc[0][1], s.pc[1][0], s.pc[1][1], side, good, bad);
      gotD++;
    }
  }
}

static void banpass(void) {
  uint64_t n = 0, ex = 0;
  for (uint64_t idx = 0; idx < NSTATE && n < 3; idx++) {
    if (idx % 9 == 0) continue;
    St s; decode(idx, &s);
    if (!slot_valid(&s, s.slot)) continue;
    int passed; int r = gen(&s, NULL, &passed);
    if (r < 0 || !passed) continue;
    St z = s; z.slot = 0; int p0; int r0 = gen(&z, NULL, &p0);
    if (r0 > 0 && !p0) { ex++; if (n < 3) { char k[64]; keystr(&s, k); printf("ban forces a pass: %s (value %d)\n", k, V[idx]); n++; } }
  }
  printf("examples found: %llu\n", (unsigned long long)ex);
}

int main(int argc, char **argv) {
  init_tables();
  if (argc >= 3 && !strcmp(argv[1], "solve")) { solve(argv[2]); return 0; }
  if (argc >= 3 && !strcmp(argv[1], "check")) { check(atoi(argv[2])); return 0; }
  if (argc >= 4 && !strcmp(argv[1], "strategy")) {
    load(argv[2]); seenS = calloc(NSTATE / 8 + 1, 1);
    uint32_t H0 = (1u << 6) | (1u << 8) | (1u << 16) | (1u << 18);
    FILE *f = fopen(argv[3], "w");
    strategy(encode(H0, 21, 23, 1, 3, 0, 0), 1, f);
    fclose(f); printf("strategy nodes %llu\n", (unsigned long long)nodesS); return 0; }
  if (argc >= 3 && !strcmp(argv[1], "sim")) {
    load(argv[2]);
    const char *L[][4] = {{"B2","D2","B4","D4"},{"A2","E2","A4","E4"},{"C2","A3","E3","C4"},{"C2","B3","D3","C4"},{"A3","B3","D3","E3"}};
    double E[] = {0.05, 0.15, 0.30, 0.50};
    for (int l = 0; l < 5; l++) {
      uint32_t h = 0; for (int i = 0; i < 4; i++) h |= 1u << cellOf(L[l][i]);
      printf("holes %s %s %s %s, pieces B5 D5 / B1 D1:\n", L[l][0], L[l][1], L[l][2], L[l][3]);
      for (int e = 0; e < 4; e++) simulate(h, 21, 23, E[e], 20000);
    }
    return 0; }
  if (argc >= 4 && !strcmp(argv[1], "probe")) { load(argv[2]); probe(atoi(argv[3])); return 0; }
  if (argc >= 3 && !strcmp(argv[1], "banpass")) { load(argv[2]); banpass(); return 0; }
  if (argc >= 3 && !strcmp(argv[1], "survey")) { load(argv[2]); survey(); return 0; }
  if (argc >= 3 && !strcmp(argv[1], "analyze")) { load(argv[2]); analyze(); return 0; }
  if (argc >= 4 && !strcmp(argv[1], "dump")) { dumpgames(atoi(argv[2]), atoi(argv[3])); return 0; }
  if (argc >= 3 && !strcmp(argv[1], "perft")) {
    St s; s.holes = (1u << 6) | (1u << 8) | (1u << 16) | (1u << 18);
    s.pc[0][0] = 21; s.pc[0][1] = 23; s.pc[1][0] = 1; s.pc[1][1] = 3; s.side = 0; s.slot = 0;
    for (int d = 1; d <= atoi(argv[2]); d++) printf("perft %d = %llu\n", d, (unsigned long long)perft(&s, d));
    return 0;
  }
  if (argc >= 3 && !strcmp(argv[1], "query")) {
    // query table holes(4 cells comma) mint(2) coral(2) side(m/c)
    load(argv[2]);
    char line[256];
    while (fgets(line, sizeof line, stdin)) {
      char h[4][3], m[2][3], c[2][3], sd;
      if (sscanf(line, "%2s %2s %2s %2s %2s %2s %2s %2s %c", h[0], h[1], h[2], h[3], m[0], m[1], c[0], c[1], &sd) != 9) continue;
      St s; s.holes = 0;
      for (int i = 0; i < 4; i++) s.holes |= 1u << cellOf(h[i]);
      int a = cellOf(m[0]), b = cellOf(m[1]); s.pc[0][0] = a < b ? a : b; s.pc[0][1] = a < b ? b : a;
      a = cellOf(c[0]); b = cellOf(c[1]); s.pc[1][0] = a < b ? a : b; s.pc[1][1] = a < b ? b : a;
      s.side = sd == 'c'; s.slot = 0;
      uint64_t idx = enc(&s, s.holes, s.side, 0);
      char buf[64];
      printf("%s", line);
      printf("  value for side to move: %s\n", valstr(V[idx], buf));
      // list moves
      uint64_t out[32]; int passed; int n = gen(&s, out, &passed);
      if (n == -1) { printf("  immediate win available\n"); continue; }
      for (int i = 0; i < n; i++) {
        St c2; decode(out[i], &c2);
        char desc[64] = "";
        if (passed) strcpy(desc, "pass");
        else if (c2.holes == s.holes) {
          int A = s.side; int from = -1, to = -1;
          for (int k = 0; k < 2; k++) {
            int x = s.pc[A][k]; if (x != c2.pc[A][0] && x != c2.pc[A][1]) from = x;
            int y = c2.pc[A][k]; if (y != s.pc[A][0] && y != s.pc[A][1]) to = y;
          }
          char f1[3], f2[3]; cellName(from, f1); cellName(to, f2); sprintf(desc, "walk %s-%s", f1, f2);
        } else {
          int src = -1, dst = -1;
          for (int x = 0; x < 25; x++) {
            if (!((s.holes >> x) & 1) && ((c2.holes >> x) & 1)) src = x;
            if (((s.holes >> x) & 1) && !((c2.holes >> x) & 1)) dst = x;
          }
          char f1[3], f2[3]; cellName(src, f1); cellName(dst, f2); sprintf(desc, "floor %s>%s", f1, f2);
        }
        uint8_t v = V[out[i]];
        // value from the mover's point of view is the opposite of the child's
        char vb[64];
        if (v < 16) strcpy(vb, "draw");
        else if (v <= 135) sprintf(vb, "loses (opp wins in %d)", v - 15);
        else sprintf(vb, "wins in %d", v - 135 + 1);
        printf("    %-14s %s\n", desc, vb);
      }
    }
    return 0;
  }
  fprintf(stderr, "usage: solver solve FILE | perft N | query FILE\n");
  return 1;
}
