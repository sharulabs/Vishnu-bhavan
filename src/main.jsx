import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, Leaf, MapPin, Phone, Clock, CalendarDays, Check, Utensils, Menu as MenuIcon, X, Heart, LoaderCircle } from 'lucide-react';
import { menu, menuSource, mapsUrl } from './menu';
import './style.css';

const foodPhoto = 'https://images.unsplash.com/photo-1743615467204-8fdaa85ff2db?auto=format&fit=crop&w=1800&q=85';
const categories = ['All favourites', 'Dosa & Idli', 'Rice & Curries', 'Kothu & Roti', 'Breakfast & Tea'];
const money = value => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
const localDate = (offset = 0) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(Date.now() + offset * 86400000));
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('-');
};
function Logo({ footer = false }) { return <a className={`logo ${footer ? 'footer-logo' : ''}`} href="#home" aria-label="Vishnu Bhavan home"><span className="logo-icon"><Utensils size={24}/></span><span>Vishnu Bhavan<small>VEGETARIAN KITCHEN</small></span></a>; }

function Booking() {
  const [mode, setMode] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const locked = useRef(false);
  const pending = useRef(null);
  const successRef = useRef(null);
  useEffect(() => { fetch('/api/config').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => setMode(data.bookingMode)).catch(() => setError('Online requests are unavailable. Please call (02) 9682 6926.')); }, []);
  useEffect(() => { if (result) successRef.current?.focus(); }, [result]);
  async function submit(event) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setErrors({});
    const fields = new FormData(event.currentTarget);
    const payload = { name: fields.get('name'), email: fields.get('email'), phone: fields.get('phone'), date: fields.get('date'), time: fields.get('time'), guests: Number(fields.get('guests')), notes: fields.get('notes'), consent: fields.get('consent') === 'on' };
    const snapshot = JSON.stringify(payload);
    if (!pending.current || pending.current.snapshot !== snapshot) pending.current = { snapshot, id: crypto.randomUUID() };
    try {
      const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pending.current.id }, body: snapshot, signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) { setErrors(data.errors || {}); throw Error(data.message || 'Please try again or call us.'); }
      setResult({ ...data, ...payload });
    } catch (err) { setError(err.name === 'TimeoutError' || err.name === 'TypeError' ? 'Connection interrupted. Please retry with the same details, or call us.' : err.message); }
    finally { locked.current = false; setBusy(false); }
  }
  function field(label, name, input) { return <label className="field">{label}{React.cloneElement(input, { name, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `${name}-error` : undefined })}{errors[name] && <span className="field-error" id={`${name}-error`}>{errors[name]}</span>}</label>; }
  return <section className="booking section" id="book"><div className="booking-intro"><span className="eyebrow">A PLACE AT OUR TABLE</span><h2>Good food.<br/>Better <em>together.</em></h2><p>A catch-up with friends, a family meal, or simply a little time for yourself. Make room for something delicious.</p><div className="booking-note"><CalendarDays/><span>Request your preferred date and time.<br/>Your table is confirmed only when the restaurant responds.</span></div><a className="text-link" href="tel:+61296826926"><Phone size={17}/> Prefer to call? (02) 9682 6926</a></div><div className="booking-card">
    {result ? <div className="booking-success" ref={successRef} tabIndex={-1}><span className="success-icon"><Check/></span><span className="eyebrow">{result.preview ? 'PREVIEW COMPLETE' : 'REQUEST RECEIVED'}</span><h3>{result.preview ? 'Your test request is saved.' : 'Thank you. Let’s make a date.'}</h3><p>{result.preview ? 'This preview has not contacted the restaurant or reserved a table. Please call to make a real booking.' : 'Your request has been sent to the restaurant. Please wait for their confirmation before visiting.'}</p><div className="confirmation"><strong>{result.reference}</strong><span>{result.guests} guests · {result.date} · {result.time}</span><span>Australia/Sydney · Pending confirmation</span></div><a className="button green" href="tel:+61296826926">Call the restaurant <Phone size={17}/></a><button className="reset-button" onClick={() => { pending.current = null; setResult(null); }}>Make another request</button></div> : <><div className="form-heading"><h3>Book a table</h3><span><Leaf size={15}/> Everyone’s welcome</span></div>{mode === 'preview' && <p className="preview-notice">Website preview: try the form below. For a real reservation, please call the restaurant.</p>}<form onSubmit={submit}><fieldset disabled={busy || !mode}><div className="form-grid">
      {field('Your name', 'name', <input autoComplete="name" placeholder="Full name" required minLength={2} maxLength={80}/>)}
      {field('Phone number', 'phone', <input type="tel" autoComplete="tel" placeholder="04XX XXX XXX" required maxLength={24}/>)}
      <div className="full-field">{field('Email address', 'email', <input type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/>)}</div>
      {field('Date', 'date', <input type="date" min={localDate()} max={localDate(90)} required/>)}
      {field('Time · Sydney', 'time', <select defaultValue="" required><option value="" disabled>Select a time</option>{Array.from({ length: 21 }, (_, i) => { const hour = 9 + Math.floor(i / 2); const minutes = i % 2 ? '30' : '00'; return <option key={i} value={`${hour.toString().padStart(2, '0')}:${minutes}`}>{hour > 12 ? hour - 12 : hour}:{minutes} {hour >= 12 ? 'pm' : 'am'}</option>; })}</select>)}
      <div className="full-field">{field('Number of guests', 'guests', <select defaultValue="2">{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1} {i ? 'guests' : 'guest'}</option>)}</select>)}</div>
      <div className="full-field">{field('Anything we should know? (optional)', 'notes', <textarea placeholder="A special occasion or dietary requirements…" maxLength={500} rows={2}/>)}</div>
    </div><label className="consent"><input name="consent" type="checkbox" required/><span>I agree to my details being used to respond to this table request.</span></label>{errors.consent && <p className="field-error">{errors.consent}</p>}<button className="button green submit" type="submit">{busy ? <><LoaderCircle className="spin" size={18}/> Sending your request…</> : <>{mode === 'preview' ? 'Try a table request' : 'Request a table'}<ArrowRight size={19}/></>}</button></fieldset>{error && <p className="form-error" role="alert">{error}</p>}<p className="form-footnote">For groups larger than 12, please call us. Requests are subject to availability.</p></form></>}
  </div></section>;
}

function App() {
  const [category, setCategory] = useState('All favourites');
  const [navOpen, setNavOpen] = useState(false);
  const items = category === 'All favourites' ? menu : menu.filter(item => item.category === category);
  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') setNavOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);
  return <><a className="skip-link" href="#main">Skip to content</a><div className="topbar"><span>South Indian soul. Sri Lankan warmth. Always vegetarian.</span><a href={mapsUrl} target="_blank" rel="noreferrer"><MapPin size={13}/> Toongabbie, Sydney <ArrowUpRight size={13}/></a></div><header><div className="header-inner"><Logo/><button className="mobile-toggle" aria-label={navOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={navOpen} aria-controls="main-nav" onClick={() => setNavOpen(!navOpen)}>{navOpen ? <X/> : <MenuIcon/>}</button><nav id="main-nav" className={navOpen ? 'open' : ''} aria-label="Main navigation"><a href="#story" onClick={() => setNavOpen(false)}>Our story</a><a href="#menu" onClick={() => setNavOpen(false)}>Our menu</a><a href="#visit" onClick={() => setNavOpen(false)}>Find us</a><a className="button green small" href="#book" onClick={() => setNavOpen(false)}>Book a table <ArrowUpRight size={16}/></a></nav></div></header>
  <main id="main"><section className="hero" id="home"><div className="hero-copy"><span className="eyebrow"><span className="eyebrow-line"/> PURE VEGETARIAN. FULL OF SOUL.</span><h1>A little taste<br/>of <em>home.</em><br/>A lot of heart.</h1><p>Golden dosas. Comforting curries. Familiar flavours.<br className="desktop-break"/> Discover South Indian and Sri Lankan vegetarian food, right here in Toongabbie.</p><div className="hero-actions"><a className="button yellow" href="#menu">Explore our menu <ArrowUpRight size={19}/></a><a className="hero-secondary" href="#book">Come, take a seat <ArrowRight size={18}/></a></div><div className="hero-bottom"><Leaf size={20}/><span>100% vegetarian</span><span className="dot-divider"/> <span>Made for sharing</span></div></div><div className="hero-visual"><div className="photo-frame"><img src={foodPhoto} alt="Illustrative photograph of crisp dosa with chutney and sambar on a banana leaf" fetchPriority="high"/></div><div className="food-stamp"><Leaf size={25}/><span>GOOD FOOD<br/>GREAT COMPANY</span><span className="stamp-star">✦</span></div><div className="photo-caption"><span>THE SIMPLE JOYS</span><strong>Crisp. Golden. Comforting.</strong><small>Illustrative food photography</small></div><span className="vertical-caption">VISHNU BHAVAN · TOONGABBIE</span></div></section>
  <div className="flavour-strip"><span>ROOTED IN TRADITION</span><i>✦</i><span>100% VEGETARIAN</span><i>✦</i><span>FROM DOSA TO KOTHU</span><i>✦</i><span>A TASTE OF HOME</span><i>✦</i></div>
  <section className="story section" id="story"><div><span className="eyebrow">VANAKKAM. WELCOME.</span><h2>Familiar flavours.<br/><em>New memories.</em></h2></div><div className="story-copy"><p>Some meals feel like coming home. At Vishnu Bhavan, explore the flavours of South India and Sri Lanka through an entirely vegetarian menu.</p><p>Find us on Portico Parade in Toongabbie. Whether you’re in the mood for dosa, a comforting rice meal or a plate of kothu, there’s a favourite waiting to be found.</p><div className="story-features"><span><Leaf size={20}/> Vegetarian kitchen</span><span><Heart size={20}/> Food to bring us together</span></div></div></section>
  <section className="menu-section section" id="menu"><div className="section-heading"><div><span className="eyebrow">SOMETHING FOR EVERY CRAVING</span><h2>Find your <em>favourite.</em></h2></div><a className="text-link" href={menuSource} target="_blank" rel="noreferrer">Full delivery menu <ArrowUpRight size={17}/></a></div><div className="category-tabs" aria-label="Menu categories">{categories.map(c => <button key={c} aria-pressed={category === c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c === 'All favourites' && <Utensils size={16}/>} {c}</button>)}</div><div className="menu-grid" aria-live="polite">{items.map((item, index) => <article className="menu-item" key={item.name}><span className="menu-index">{String(index + 1).padStart(2, '0')}</span><div><span className="dish-category">{item.category}</span><div className="dish-title"><h3>{item.name}</h3><span>{money(item.price)}</span></div><p>{item.description}</p>{item.tag && <span className="dish-tag"><Leaf size={12}/>{item.tag}</span>}</div></article>)}</div><div className="menu-disclaimer"><Leaf size={17}/><p>All dishes vegetarian. Please speak with the restaurant about allergies and vegan options.<br/><small>Indicative online delivery prices in AUD, checked 25 September 2026. Dine-in prices and availability may differ.</small></p></div></section>
  <div className="invitation"><span>GOOD COMPANY. GREAT CONVERSATION.</span><p>There’s always a reason<br/>to gather around <em>good food.</em></p><a href="#book">Let’s make a date <ArrowUpRight size={22}/></a></div>
  <Booking/>
  <section className="visit section" id="visit"><div><span className="eyebrow">YOUR NEXT FAVOURITE SPOT</span><h2>See you in<br/><em>Toongabbie.</em></h2><p>Drop by for a meal. Stay for another cup of tea.</p><a className="button green" href={mapsUrl} target="_blank" rel="noreferrer">Get directions <ArrowUpRight size={18}/></a></div><div className="visit-details"><div><MapPin/><section><h3>Find our kitchen</h3><p>5A Portico Parade<br/>Toongabbie NSW 2146, Australia</p></section></div><div><Clock/><section><h3>Plan your visit</h3><p>Monday–Tuesday & Thursday–Sunday<br/>Wednesday listed as closed</p><small>Published hours vary. Please call to confirm before visiting.</small></section></div><div><Phone/><section><h3>Give us a call</h3><a href="tel:+61296826926">(02) 9682 6926</a></section></div></div></section></main>
  <footer><div className="footer-main"><Logo footer/><p>South Indian & Sri Lankan flavours.<br/>A vegetarian kitchen with heart.</p><a href="#home">Back to top ↑</a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Vishnu Bhavan · Website concept</span><span>Restaurant information: <a href="https://www.zmenu.com/vishnu-bhavan-vegetarian-restaurant-toongabbie-toongabbie-online-menu/" target="_blank" rel="noreferrer">listing</a> · <a href={menuSource} target="_blank" rel="noreferrer">menu</a></span><a href="https://unsplash.com/photos/a-delicious-dosa-is-served-with-sides-3qHDm3IQCUs" target="_blank" rel="noreferrer">Photo: Zoshua Colah / Unsplash</a></div></footer></>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
