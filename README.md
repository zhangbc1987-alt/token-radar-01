# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/zhangbc1987-alt/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/zhangbc1987-alt/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar: ranks 197 pre-token protocols by implied launch value, derived only from a sealed DeFiLlama snapshot — TVL, comparable launched protocols' FDV/TVL, 7-day growth, time without a token, and chain count. Every row carries a concrete farm plan (steps, cost, time), and the dashboard is sortable, filterable, and has per-protocol detail.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

Node 22, standard library only. No network, no clock, no randomness: two runs on the same snapshot write byte-identical output (`board.json`, `data.js`, `dashboard/`, `screenshots/`, `dossier.json`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=xht0j9xw&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
