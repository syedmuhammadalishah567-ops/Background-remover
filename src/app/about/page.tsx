import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import styles from "../prose.module.css";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE.name} removes image backgrounds for free with open-source AI that runs in your browser.`,
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <article className={`wrap ${styles.page}`}>
      <h1>About {SITE.name}</h1>
      <p>
        {SITE.name} removes the background from photos in a few seconds. It&rsquo;s built for online sellers,
        creators, designers and anyone who needs a clean cutout without paying for an app.
      </p>
      <h2>How it works</h2>
      <p>
        The cutout is made by ORMBG (Open Remove Background), an open-source AI model released under the Apache 2.0
        license. It runs inside your browser, so your photos are never uploaded.
      </p>
      <h2>Contact</h2>
      <p>Questions or feature ideas? Email hello@example.com.</p>
    </article>
  );
}
