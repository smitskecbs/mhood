# MoginHood Forest

Lokale community-app voor de MoginHood-holderpoort. Dit is een eigen initiatief, gebouwd rond de MoginHood-sfeer: donker bos, verborgen toegang, rustig en cinematic. Geen CBS-branding, geen ManGo-branding.

Deze eerste versie is **alleen lokaal**. Er is nog niets gedeployed en er hoeft nog niets naar GitHub.

## Wat het is

Een fullscreen webapp met drie scènes:

1. **Gate I** — `backgrounds/background1.jpg` met subtiele grain, flicker en glitch.
2. **Gate II** — crossfade naar `backgrounds/background2.jpg` en een wallet-gate.
3. **The Forest** — `backgrounds/background3.jpg` na een on-chain MHOOD holder-check.

The forest-pagina toont wallet-samenvatting, holder ranking, burn ranking en een burn-interface.

Ondersteunde wallets: **Backpack**, Phantom en Solflare.

Het DEV gate-panel is standaard **uit**. Zet `VITE_SHOW_GATE_DEBUG=true` alleen als je on-chain debugvelden in beeld wilt.

## Lokale setup

Vereisten: Node.js 20+ en npm.

```bash
cd C:\Users\kevin\cbs-projects\mhood
npm install
npm run dev
```

Open daarna **http://localhost:5173**.

Andere commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Environment

Kopieer `.env.example` naar `.env` (staat al klaar voor lokale development).

```env
VITE_SOLANA_RPC_URL=
VITE_MHOOD_MINT=EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs
VITE_MHOOD_ACCESS_THRESHOLD=1000000
VITE_ENABLE_REAL_BURN=false
VITE_DEV_BYPASS_GATE=false
VITE_SHOW_GATE_DEBUG=false
```

- `.env` staat in `.gitignore`. Zet hier geen geheime API keys in git.
- Vul `VITE_SOLANA_RPC_URL` met **jouw eigen Solana mainnet RPC** (Helius, QuickNode, Alchemy, …). De publieke `api.mainnet-beta.solana.com` geeft in de browser HTTP 403. De app valt daar niet meer stil op terug.
- Herstart `npm run dev` na het zetten van de RPC-URL.

## MHOOD mint en threshold

- Mint: `EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs`
- Toegang: minimaal **1.000.000 MHOOD** (UI-bedrag, geen raw integer)
- Decimals worden **on-chain uit het mint-account** gelezen. De app gaat daar niet blind vanuit.

Tijdens de eerste lokale build is on-chain vastgesteld:

- Token program: classic **SPL Token** (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`)
- Niet Token-2022
- Mint account size: 82 bytes
- Decimals: **6**
- Mint- en freeze-authority: revoked

De runtime-code blijft dit opnieuw lezen via RPC.

## Architectuur

```text
src/
  app/                 # providers + scene-orchestratie
  components/          # Gate, Forest, rankings, burn UI
  services/
    mhoodBalanceService.ts
    holderRankingService.ts
    burnService.ts
    burnRankingService.ts
    providers/         # mock + toekomstige indexer adapters
    solana/            # connection + mint reader
  hooks/
  types/
  utils/
  config/
```

Services hebben een vaste interface. Ranking-providers zijn vervangbaar zonder de UI te herschrijven.

## Wallet / holder check

Bezoekers moeten **bewust** `Open the gate` klikken. Er is geen auto-connect bij page load.

Daarna:

1. Wallet kiezen (Backpack / Phantom / Solflare) in de gate-kaart.
2. De app roept **expliciet** `connect()` aan vanuit die klik (niet via `autoConnect`).
3. Public key lezen via `@solana/wallet-adapter-react`.
4. **Sign Message authenticatie:** de bezoeker klikt `Sign to enter` en ondertekent een MoginHood access-message in de wallet.
5. De signature wordt **client-side cryptografisch geverifieerd** (Ed25519) tegen de exacte UTF-8 message bytes en de connected public key.
6. Pas na een geldige signature: mint-account ophalen (owner = token program, decimals on-chain).
7. Alle token accounts van die wallet + mint ophalen met `getParsedTokenAccountsByOwner`.
8. Raw balances als `bigint` optellen (meerdere accounts van dezelfde mint tellen mee).
9. Vergelijken met `1_000_000 * 10^decimals`.
10. Bij toegang: **nog een keer** de balance herlezen voordat de forest opent.

Een bestaande wallet-connection alleen is **niet** genoeg. Zonder geldige signature start de MHOOD holder-check niet en opent het Forest niet.

Belangrijk:

- Access en authentication zitten **niet** in `localStorage`. Een eerdere walletnaam wordt bij page load vergeten, zodat er niet stil wordt herverbonden.
- Refresh, disconnect of account-wissel eist opnieuw: `Open the gate` → connect → `Sign to enter` → holder-check.
- Frontend gating is **geen** server-side authorization.

### Sign-message security boundary

De client-side signature bewijst lokaal dat de bezoeker controle heeft over de private key van de connected wallet. Dat is genoeg voor deze lokale/demo access-flow (UX + holder gate).

Als de Forest later echte protected server resources krijgt (niet-publieke API's, sessies, backend ranking), moeten nonce-issuance en signature-verification **server-side** gebeuren. Een browser kan zijn eigen `walletAuthenticated = true` niet als autorisatiegrens dienen.

Deze versie slaat signatures niet op en behandelt authentication als session-only React state.

## Cinematic timing

Normale ervaring (zonder `prefers-reduced-motion`):

1. Gate I ±2.4s
2. Crossfade naar Gate II ±2.8s
3. Alleen `background2.jpg` ±10s (geen wallet-UI)
4. Wallet-kaart fade-in ±1.8s
5. Connect → **Sign to enter** → holder-check → ACCESS GRANTED ±1.8s
6. Crossfade naar het Forest ±2.2s
7. Alleen `background3.jpg` ±4.5s
8. Dashboard in vijf rustige stappen (wallet → stats → holders → tokenomics → burns)

Reduced motion verkort deze wachttijden en zet glitch/flicker uit.

## Holder ranking

De app haalt **echte** MHOOD token accounts op via Helius DAS:

```text
JSON-RPC method: getTokenAccounts
params: { mint, page, limit: 1000, options: { showZeroBalance: false } }
```

Pagina's worden afgelopen tot een lege of korte pagina, met een veiligheidslimiet tegen oneindige loops. Meerdere token accounts van dezelfde owner worden als `bigint` opgeteld. Zero balances verdwijnen. Sortering is hoog → laag. `% Supply` gebruikt de actuele mint `supply`.

De connected wallet krijgt een **community** `Holder Rank: #N` (project/tokenomics-wallets tellen niet mee in die lijst). Valt die buiten de zichtbare Top 100, dan volgt `Your position`.

Project wallets blijven in de on-chain supply-berekening en staan apart onder **TOKEN DISTRIBUTION** met live balances.

Forest access (`>= 1,000,000 MHOOD`) en ranking (elke positieve community-balance) zijn gescheiden. Ranking-fouten sluiten de forest niet en disconnecten de wallet niet.

Lokaal wordt de ranking ±5 minuten gecached. **Retry** haalt opnieuw op.

Mock holder-rijen zitten **niet** meer in de normale UI; alleen in tests.

## Burn ranking

Forest Legends toont alleen **on-chain geverifieerde** `BurnRecord`s:

- signature (uniek)
- wallet
- mint
- amountRaw / amountUi
- slot
- timestamp

De lokale demo bewaart verified signatures via `GET/POST /api/verified-burns` (Vite-dev middleware, bestand `data/verified-burns.json`). De browser is geen source of truth: POST stuurt alleen een signature, de server haalt de transactie op en controleert BurnChecked (mint, authority, amount) voordat een record wordt toegevoegd. Dubbele signatures worden genegeerd.

Productie heeft later een echte backend/database nodig. `localStorage` wordt niet gebruikt voor Forest Legends.

Geen fake burn-records in de gewone UI. Simulation-burns (`VITE_ENABLE_REAL_BURN=false`) gaan niet naar de ranking.

## Project / tokenomics wallets

Bekende project wallets staan in `src/config/projectWallets.ts` en verdwijnen uit **FOREST HOLDERS**. Hun live balances blijven meetellen voor supply en **TOKEN DISTRIBUTION**.

## NFT reward (voorbereiding)

`qualifiesForBurnReward(amountRaw)` is een pure helper: één verified burn van minimaal **10,000 MHOOD** (`10_000 × 10^6` raw) kan later kwalificeren. Er is nog geen NFT-mint, geen mint authority en geen reward-backend.

## Client-side RPC keys

`VITE_SOLANA_RPC_URL` is voor **lokale development** acceptabel.

`VITE_`-variabelen worden in de browserbundel opgenomen. Een private Helius API key in die URL is **geen** geheime server-key. Iedereen met de gebundelde site kan die key uitlezen.

Voor productie later:

- backend of serverless proxy voor RPC / holder ranking
- ranking server-side ophalen en cachen
- provider credentials alleen server-side houden

Bouw die backend nog niet in deze lokale versie.

## Burn safety

Standaard:

```env
VITE_ENABLE_REAL_BURN=false
```

In deze modus:

- De UI werkt volledig (input, percentages, preview, confirm).
- De app bouwt officiële `createBurnCheckedInstruction`s (SPL Token of Token-2022, afhankelijk van mint owner).
- Er wordt **geen** transactie naar de wallet gestuurd.
- Er gaan **geen** tokens naar een willekeurig "burn address".
- Het resultaat is expliciet **SIMULATED**.

Echte burn later aanzetten:

1. Lokaal en met een throwaway mint of tiny amount testen.
2. Eigen RPC gebruiken.
3. Pas daarna `VITE_ENABLE_REAL_BURN=true` zetten.
4. De gebruiker moet de transactie zelf in de wallet bevestigen. Geen autosign, geen private keys, geen seed phrases.

## TODO vóór GitHub / productie

- RPC/API keys achter een backend/proxy zetten; nooit als `VITE_` secret behandelen.
- Holder ranking server-side cachen.
- Burn-indexer aansluiten op echte `BurnChecked` transacties.
- Optionele backend access-check als er ooit niet-publieke forest-content komt.
- `VITE_ENABLE_REAL_BURN` bewust beslissen; default moet false blijven tot de flow op een testmint is geverifieerd.
- Error monitoring, rate-limit handling, en een productie-`.env` zonder secrets in git.
- Eventueel een custom domain en HTTPS deploy, pas ná lokale goedkeuring.
