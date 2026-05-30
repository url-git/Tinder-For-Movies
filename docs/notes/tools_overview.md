# Supabase i Netlify – przegląd funkcjonalności

Dokument opisuje kluczowe funkcjonalności obu narzędzi używanych w projekcie CineMatch.
Kolumna **W projekcie / Potencjał** wyjaśnia jak dana funkcja była wykorzystana lub jak można ją zastosować rozwijając aplikację.

★ = wykorzystane w projekcie CineMatch

---

## Supabase

| # | Funkcjonalność | Opis | W projekcie / Potencjał |
|---|---------------|------|-------------------------|
| 1 | ★ **PostgreSQL Database** | Pełna relacyjna baza danych w chmurze. Tworzy się tabele, relacje i indeksy tak samo jak w lokalnym PostgreSQL. | Stworzyliśmy dwie tabele: `sessions` (przechowuje kod sesji, gatunek i listę filmów) oraz `votes` (głosy obu graczy). Relacja między tabelami jest zabezpieczona kluczem obcym z kaskadowym usuwaniem. |
| 2 | ★ **Row Level Security (RLS)** | Polityki bezpieczeństwa na poziomie wierszy — decydujesz kto może czytać i pisać dane bez logowania użytkownika. | Włączyliśmy RLS na obu tabelach i stworzyliśmy otwarte polityki (`USING (true)`) pozwalające anonimowym użytkownikom na pełny dostęp. Wymagało to dodatkowo ręcznego `GRANT ALL` dla roli `anon`. |
| 3 | ★ **Realtime** | Subskrypcje na zmiany w bazie danych w czasie rzeczywistym. Aplikacja natychmiast dostaje powiadomienie gdy inny użytkownik doda lub zmieni rekord. | Obaj gracze subskrybują zmiany w tabeli `votes` i `sessions` dla swojej sesji. Dzięki temu gracz 1 widzi ekran startu gdy gracz 2 dołączy, a wykrycie dopasowania (match) działa bez odświeżania strony. |
| 4 | ★ **Auto-generated REST API** | Każda tabela automatycznie dostaje endpoint REST. Nie trzeba pisać backendu — Supabase generuje API z definicji schematu. | Supabase JS Client korzysta z tego API w tle — wywołania `sb.from("sessions").select()`, `.insert()` czy `.update()` to zapytania do auto-generowanego REST API. |
| 5 | ★ **API Keys (anon/service)** | Dwa klucze dostępu: `anon` dla frontendu (ograniczone przez RLS) i `service_role` dla backendu (pełny dostęp). | Klucz `anon` jest serwowany frontendowi przez funkcję serverless `/api/config`. Nigdy nie trafia do repozytorium — żyje wyłącznie w zmiennych środowiskowych Netlify i lokalnym `.env`. |
| 6 | ★ **SQL Editor** | Wbudowany edytor SQL w dashboardzie. Pozwala uruchamiać dowolne zapytania i skrypty bezpośrednio w przeglądarce. | Użyliśmy go do uruchomienia skryptu `supabase.sql` tworzącego tabele i polityki RLS, a następnie do ręcznego wykonania polecenia `GRANT ALL` dla roli `anon`. |
| 7 | **Authentication** | Gotowy system logowania — email/hasło, magic link, OAuth (Google, GitHub itp.). Integruje się z RLS automatycznie. | Można dodać opcjonalne konta użytkowników, by gracze mieli historię swoich dopasowań i statystyki. RLS można wtedy ograniczyć tylko do właściciela sesji zamiast otwartego dostępu. |
| 8 | **Storage** | Przechowywanie plików (obrazy, wideo, dokumenty) z kontrolą dostępu przez polityki podobne do RLS. | Można przechowywać własne plakaty filmów lub avatary graczy, jeśli aplikacja miałaby własną bazę filmów niezależną od TMDB. |
| 9 | **Edge Functions** | Serverless functions pisane w TypeScript/Deno, uruchamiane blisko użytkownika. Odpowiednik Netlify Functions, ale wbudowany w Supabase. | Gdyby projekt miał być hostowany bez Netlify (np. na własnym serwerze), Edge Functions mogłyby przejąć rolę proxy do TMDB API i serwowania kluczy konfiguracyjnych. |
| 10 | **Database Webhooks** | Automatyczne wywołanie zewnętrznego URL gdy zajdzie zmiana w tabeli (INSERT/UPDATE/DELETE). Przydatne do triggerowania innych serwisów. | Po wykryciu dopasowania (INSERT do `votes`) webhook mógłby wysłać powiadomienie push na telefon gracza lub e-mail z rekomendacją filmu wraz z linkiem do trailera. |

---

## Netlify

| # | Funkcjonalność | Opis | W projekcie / Potencjał |
|---|---------------|------|-------------------------|
| 1 | ★ **Static Hosting + CDN** | Hostowanie plików HTML/CSS/JS na globalnej sieci CDN. Strona ładuje się z serwera najbliższego użytkownikowi. | Cały frontend (index.html, style.css, script.js) jest serwowany jako pliki statyczne. Netlify automatycznie dystrybuuje je na swoje węzły CDN na całym świecie po każdym deploy. |
| 2 | ★ **Serverless Functions** | Funkcje Node.js uruchamiane na żądanie bez zarządzania serwerem. | Napisaliśmy dwie funkcje: `config.js` (serwuje klucze Supabase frontendowi) i `movies.js` (proxy do TMDB API ukrywające klucz API). Obie działają jako osobne procesy uruchamiane tylko gdy frontend wyśle żądanie. |
| 3 | ★ **Environment Variables** | Bezpieczne przechowywanie kluczy API i sekretów w panelu. Funkcje serverless mają do nich dostęp przez `process.env`. | Trzy klucze (`TMDB_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) są przechowywane jako zaszyfrowane zmienne w panelu Netlify i nigdy nie trafiają do repozytorium Git. |
| 4 | ★ **Redirects & Rewrites** | Reguły przekierowań w `netlify.toml` — pozwalają mapować ścieżki URL na inne zasoby. | W `netlify.toml` skonfigurowaliśmy regułę `from = "/api/:splat"` → `to = "/.netlify/functions/:splat"`, dzięki czemu frontend wywołuje `/api/movies` zamiast długiej ścieżki do funkcji. |
| 5 | **Continuous Deployment** | Automatyczny deploy po każdym push do GitHuba. Netlify buduje i wdraża aplikację bez żadnej ręcznej interwencji. | Po podłączeniu repozytorium każdy `git push` na gałąź `main` automatycznie wdroży nową wersję aplikacji. Wystarczy skonfigurować raz — kolejne aktualizacje nie wymagają logowania do panelu. |
| 6 | **Deploy Previews** | Każdy Pull Request dostaje własny tymczasowy URL z podglądem zmian. | Przed wdrożeniem nowej funkcji (np. historia dopasowań, ranking filmów) można otworzyć Pull Request i dostać osobny URL do testów — bez ryzyka zepsucia działającej produkcji. |
| 7 | **Branch Deploys** | Każda gałąź git może mieć własne środowisko (np. `staging.twoja-strona.netlify.app`). | Można stworzyć gałąź `dev` ze środowiskiem testowym podłączonym do osobnego projektu Supabase, by testować zmiany w bazie bez wpływu na sesje prawdziwych użytkowników. |
| 8 | **Form Handling** | Wbudowana obsługa formularzy HTML — Netlify zbiera zgłoszenia bez żadnego backendu, dostępne w panelu lub przez webhook. | Można dodać formularz feedbacku po zakończeniu seansu („Czy film był dobry?") — Netlify zbierałby odpowiedzi bez pisania jakiegokolwiek backendu. |
| 9 | **Identity (Auth)** | Gotowy system rejestracji i logowania użytkowników zintegrowany z platformą. | Alternatywa dla Supabase Auth — można by dodać konta użytkowników by pamiętać historię wspólnych wieczorów filmowych i ulubione gatunki pary. |
| 10 | **Analytics** | Podstawowe statystyki ruchu (pageviews, unikalni użytkownicy) bez ciasteczek i bez spowolnienia strony. | Po deploymencie można włączyć jednym kliknięciem w panelu Netlify — pozwoli sprawdzić ile par korzysta z aplikacji, z jakich krajów i o jakich porach. |
