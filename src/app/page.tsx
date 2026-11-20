import Remover from "@/components/Remover";
import AdSlot from "@/components/AdSlot";
import { SITE } from "@/lib/site";
import styles from "./page.module.css";

const USES = [
  { title: "Product photos", text: "White or colored backgrounds for Amazon, Etsy, Shopify and Daraz listings. Add a drop shadow so items sit naturally." },
  { title: "Profile pictures", text: "Clean headshots for LinkedIn, CVs and team pages. Swap in a solid color that matches your brand." },
  { title: "Thumbnails and posts", text: "Cut yourself out for YouTube thumbnails, Instagram posts and presentations." },
  { title: "Stickers and design", text: "Transparent PNGs for Canva, Figma, WhatsApp stickers and print. Trim to subject removes the empty space." },
];

const FAQ = [
  {
    q: "Is this background remover free?",
    a: "Yes. There's no sign-up, no watermark and no limit. You download the full-resolution image.",
  },
  {
    q: "Are my photos uploaded?",
    a: "No. The AI model runs inside your browser, so your photos never leave your device.",
  },
  {
    q: "Which AI model does it use?",
    a: "ORMBG (Open Remove Background), an open-source model released under the Apache 2.0 license and trained on openly licensed data. It handles people, products, animals and objects, including fine edges like hair.",
  },
  {
    q: "Why does the first photo take longer?",
    a: "The first time, your browser downloads the AI model (about 45–90 MB). It starts downloading in the background as soon as you open the page, and it's cached after that, so later photos take only a few seconds.",
  },
  {
    q: "How do I get a white background instead of transparent?",
    a: "Choose Color, then white. You can also pick any color, or Blur to keep a softened version of the original background.",
  },
  {
    q: "PNG or JPG?",
    a: "Use PNG for a transparent background. Use JPG for a smaller file when you've chosen a color or blurred background.",
  },
];

export default function Home() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE.name,
      url: SITE.url,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="wrap">
        <section className={styles.hero}>
          <h1 className={styles.title}>
            Cut the <span className={`${styles.selected} ants`}>background</span> out of any photo
          </h1>
          <p className={styles.intro}>
            Drop in a photo and get a clean transparent PNG at full resolution. Open-source AI runs on your device, so
            it&rsquo;s private and free, with no watermark.
          </p>
        </section>

        <Remover />

        <AdSlot slot={SITE.adSlots.afterTool} format="horizontal" />

        <section className={styles.section} aria-labelledby="uses">
          <h2 id="uses" className={styles.sectionTitle}>
            What people use it for
          </h2>
          <ul className={styles.uses}>
            {USES.map((u) => (
              <li key={u.title}>
                <h3>{u.title}</h3>
                <p>{u.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <AdSlot slot={SITE.adSlots.inContent} />

        <section className={styles.section} aria-labelledby="faq">
          <h2 id="faq" className={styles.sectionTitle}>
            Questions
          </h2>
          <div className={styles.faq}>
            {FAQ.map((f) => (
              <details key={f.q} className={styles.qa}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
