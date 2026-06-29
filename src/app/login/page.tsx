"use client";

import { useState, useEffect } from "react";
import { signIn } from "./actions";

const T = {
  ar: {
    appName: "قُبا",
    loginSub: "لوحة إدارة الغرف",
    signIn: "تسجيل الدخول",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    loginErr: "اسم المستخدم أو كلمة المرور غير صحيحة",
    langToggle: "EN",
  },
  en: {
    appName: "Quba",
    loginSub: "Room management",
    signIn: "Sign in",
    username: "Username",
    password: "Password",
    loginErr: "Incorrect username or password",
    langToggle: "ع",
  },
} as const;

type Lang = "ar" | "en";
type Theme = "light" | "dark";

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setTheme] = useState<Theme>("light");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const l = localStorage.getItem("quba_lang") as Lang | null;
    const t = localStorage.getItem("quba_theme") as Theme | null;
    if (l === "ar" || l === "en") {
      setLang(l);
    } else {
      // Auto-detect: default English unless browser language is explicitly Arabic
      const browserLang = (navigator.language || "").toLowerCase();
      setLang(browserLang.startsWith("ar") ? "ar" : "en");
    }
    if (t === "dark" || t === "light") setTheme(t);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("quba_lang", lang);
    localStorage.setItem("quba_theme", theme);
  }, [lang, theme, mounted]);

  const t = (k: keyof typeof T.ar) => T[lang][k];

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setError(false);
    setLoading(true);
    const result = await signIn(username, password);
    setLoading(false);
    if (result?.error) setError(true);
  }

  const moonIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" strokeLinejoin="round"/>
    </svg>
  );
  const sunIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4.5"/>
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" strokeLinecap="round"/>
    </svg>
  );
  const eyeIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
  const eyeOffIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" strokeLinecap="round"/>
      <path d="M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.3 3.9M6.5 7.5A17 17 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 3.4-.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.5 10.5a3 3 0 0 0 4 4" strokeLinecap="round"/>
    </svg>
  );

  if (!mounted) return null;

  return (
    <>
      <style>{`
        :root {
          --navy:#1B2A47; --gold:#C6A253; --gold-deep:#A4924E; --cream:#F6F1E7;
          --bg:#FBFAF7; --surface:#FFFFFF; --surface-2:#F3F0E9;
          --line:rgba(20,22,34,.10); --line-soft:rgba(20,22,34,.06);
          --text:#1b1d22; --dim:#5f6672; --faint:#9aa0aa;
          --shadow:0 1px 2px rgba(20,22,34,.04), 0 6px 20px -12px rgba(20,22,34,.18);
          --shadow-lift:0 10px 40px -16px rgba(20,22,34,.30);
          --maint:#CC4B4B;
          --font:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI","IBM Plex Sans Arabic","Helvetica Neue",system-ui,"Noto Sans Arabic",sans-serif;
        }
        [data-theme="dark"] {
          --bg:#0c1118; --surface:#141b26; --surface-2:#1b2330;
          --line:rgba(255,255,255,.11); --line-soft:rgba(255,255,255,.06);
          --text:#ECEAE2; --dim:#9aa3b2; --faint:#6b7480;
          --shadow:0 1px 2px rgba(0,0,0,.3), 0 8px 26px -14px rgba(0,0,0,.7);
          --shadow-lift:0 18px 50px -18px rgba(0,0,0,.8);
          --maint:#dd6363;
        }
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        html,body{height:100%}
        body{
          font-family:var(--font);
          background:var(--bg);
          color:var(--text);
          line-height:1.5;
          -webkit-font-smoothing:antialiased;
          text-rendering:optimizeLegibility;
          font-variant-numeric:tabular-nums;
          font-feature-settings:"tnum";
          min-height:100dvh;
        }
        button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
        input{font-family:inherit}
        ::selection{background:rgba(198,162,83,.28)}

        .login{
          min-height:100dvh;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:24px;
          position:relative;
        }
        .login::before{
          content:"";
          position:absolute;
          inset:0;
          pointer-events:none;
          background:radial-gradient(900px 500px at 50% -10%, color-mix(in srgb,var(--gold) 12%, transparent), transparent 60%);
        }
        .login-top{
          position:fixed;
          top:calc(env(safe-area-inset-top) + 14px);
          inset-inline-end:16px;
          display:flex;
          gap:8px;
          z-index:3;
        }
        .login-card{
          position:relative;
          z-index:2;
          width:100%;
          max-width:384px;
          background:color-mix(in srgb,var(--surface) 78%,transparent);
          backdrop-filter:blur(26px) saturate(180%);
          -webkit-backdrop-filter:blur(26px) saturate(180%);
          border:1px solid var(--line-soft);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.6),var(--shadow-lift);
          border-radius:26px;
          padding:36px 30px 30px;
          text-align:center;
          animation:rise .5s cubic-bezier(.2,.8,.25,1) both;
          overflow:hidden;
        }
        [data-theme="dark"] .login-card{
          background:color-mix(in srgb,var(--surface) 58%,transparent);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.07),var(--shadow-lift);
        }
        .login-card::after{
          content:"";
          position:absolute;
          inset:0;
          border-radius:inherit;
          pointer-events:none;
          background:linear-gradient(135deg,rgba(255,255,255,.20),rgba(255,255,255,0) 40%);
        }
        [data-theme="dark"] .login-card::after{
          background:linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,0) 42%);
        }
        .login-logo{
          width:62px;
          height:62px;
          object-fit:contain;
          margin:0 auto 16px;
          filter:drop-shadow(0 6px 18px rgba(198,162,83,.2));
          display:block;
        }
        .login-card h1{
          font-size:25px;
          font-weight:800;
          letter-spacing:-.02em;
          line-height:1.1;
          color:var(--text);
        }
        [dir="rtl"] .login-card h1{letter-spacing:0}
        .login-card .sub{
          font-size:13px;
          color:var(--faint);
          font-weight:600;
          margin-bottom:26px;
          letter-spacing:.04em;
        }
        .login-card .field{text-align:start;margin-bottom:13px}
        .login-card .err{
          color:var(--maint);
          font-size:13px;
          font-weight:600;
          margin-top:13px;
          min-height:18px;
        }
        .login-foot{
          margin-top:22px;
          font-size:11px;
          color:var(--faint);
          letter-spacing:.16em;
          font-weight:700;
        }
        .login-foot .st{color:var(--gold)}

        .iconbtn{
          width:40px;height:40px;border-radius:50%;
          display:grid;place-items:center;
          background:var(--surface-2);color:var(--text);
          transition:transform .14s,background .2s;flex:none;
        }
        .iconbtn:active{transform:scale(.9)}
        .iconbtn svg{width:18px;height:18px}
        .iconbtn.lang{font-weight:800;font-size:13px}

        .field label{
          display:block;font-size:12.5px;font-weight:700;
          color:var(--dim);margin-bottom:6px;
        }
        .field input{
          width:100%;
          background:color-mix(in srgb,var(--surface) 68%,transparent);
          backdrop-filter:blur(8px) saturate(140%);
          -webkit-backdrop-filter:blur(8px) saturate(140%);
          border:1px solid var(--line);
          border-radius:11px;
          padding:12px 14px;
          font-size:15px;
          color:var(--text);
          transition:border-color .2s,box-shadow .2s;
          outline:none;
        }
        .field input:focus{
          border-color:var(--gold);
          box-shadow:0 0 0 4px rgba(198,162,83,.12);
        }

        .pw-wrap{position:relative}
        .pw-wrap input{padding-inline-end:44px}
        .eye{
          position:absolute;
          inset-inline-end:6px;
          top:50%;
          transform:translateY(-50%);
          width:34px;height:34px;
          border-radius:9px;
          display:grid;place-items:center;
          color:var(--faint);
          transition:color .15s,background .15s;
        }
        .eye:hover{color:var(--dim);background:var(--surface-2)}
        .eye svg{width:18px;height:18px}

        .btn{
          display:flex;align-items:center;justify-content:center;gap:9px;
          width:100%;padding:15px;border-radius:14px;
          font-size:15px;font-weight:700;letter-spacing:-.01em;
          transition:transform .14s,filter .2s;
        }
        .btn:active{transform:scale(.98)}
        .btn.primary{
          background:var(--navy);color:#fff;
          box-shadow:0 8px 22px -10px rgba(27,42,71,.5);
        }
        [data-theme="dark"] .btn.primary{background:var(--gold);color:#1b1407}
        .btn.primary:disabled{opacity:.7;cursor:not-allowed}

        @keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
      `}</style>

      {/* Drifting gold glow — ambient brand feel */}
      <div className="login-glow" aria-hidden="true" />

      <div className="login">
        {/* top-right: lang + theme */}
        <div className="login-top">
          <button
            className="iconbtn lang"
            onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
          >
            {t("langToggle")}
          </button>
          <button
            className="iconbtn"
            onClick={() => setTheme(th => th === "light" ? "dark" : "light")}
          >
            {theme === "light" ? moonIcon : sunIcon}
          </button>
        </div>

        <div className="login-card">
          {/* real logo from prototype */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="login-logo" src="/logo.png" alt="Quba" />

          <h1>{t("appName")}</h1>
          <p className="sub">{t("loginSub")}</p>

          <form onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="l-u">{t("username")}</label>
              <input
                id="l-u"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={e => { setUsername(e.target.value); setError(false); }}
              />
            </div>

            <div className="field">
              <label htmlFor="l-p">{t("password")}</label>
              <div className="pw-wrap">
                <input
                  id="l-p"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(false); }}
                />
                <button
                  type="button"
                  className="eye"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                >
                  {showPw ? eyeOffIcon : eyeIcon}
                </button>
              </div>
            </div>

            <p className="err">{error ? t("loginErr") : " "}</p>

            <button type="submit" className="btn primary" disabled={loading}>
              {loading && (
                <svg
                  width="18" height="18" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ animation: "spin .8s linear infinite" }}
                >
                  <circle cx="12" cy="12" r="9" strokeOpacity=".25"/>
                  <path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round"/>
                </svg>
              )}
              {t("signIn")}
            </button>
          </form>

          <p className="login-foot">AURION <span className="st">·</span> HOTELS</p>
        </div>
      </div>
    </>
  );
}
