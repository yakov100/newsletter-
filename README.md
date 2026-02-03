# מערכת כתיבה חכמה (Newsletter / תוכן)

מערכת שמלווה מרעיון מעורפל לכתבה ברורה – בלי בלגן. זרימה ליניארית: רעיונות → בחירה → כתיבה → עריכה → סיום.

## התחלה

```bash
npm install
cp .env.example .env.local
# ערוך .env.local עם OPENAI_API_KEY ו/או Supabase
npm run dev
```

פתח [http://localhost:3000](http://localhost:3000).

## משתני סביבה

- **OPENAI_API_KEY** – (אופציונלי) ליצירת רעיונות, שלד כתבה והצעות עריכה. בלי מפתח – משתמשים ב-mock.
- **OPENAI_MODEL** – (אופציונלי) ברירת מחדל: `gpt-4o-mini`.
- **NEXT_PUBLIC_SUPABASE_URL**, **NEXT_PUBLIC_SUPABASE_ANON_KEY** – (אופציונלי) להתחברות ושמירה לארכיון. בלי – "שמירה לארכיון" ידרוש התחברות ותחזיר 503 אם Supabase לא מוגדר.

## הגדרות סוכנים

בעמוד **הגדרות** (/settings) מגדירים את "מוח" סוכן הרעיונות וסוכן הכתיבה. ההגדרות נשמרות ב-`data/agent-config.json` ומשמשות בכל קריאת AI.

## Supabase

הרצת מיגרציות (אם משתמשים ב-Supabase):

```bash
supabase db push
# או ייבא ידנית את supabase/migrations/00001_init.sql
```

## בנייה

```bash
npm run build
npm start
```
