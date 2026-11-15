import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

type Topic = {
  title: string;
  description: string;
  to: string;
  tags: string[];
};

const topics: Topic[] = [
  {
    title: 'Modern payment platform',
    description:
      'Greenfield payments platform for an Australian bank: one rail-agnostic ISO 20022 hub with adapters for NPP, PayTo, BECS, BPAY, high-value RTGS and SWIFT.',
    to: '/docs/modern-payment-platform/docs/exec-brief',
    tags: ['Payments', 'ISO 20022', 'Australia'],
  },
  {
    title: 'Large PDF delivery',
    description:
      'Serving a 1,000-page, 200 MB PDF to desktop and mobile apps: range requests over a CDN, server-side search, page chunks for mobile and a safe ingestion pipeline.',
    to: '/docs/large-pdf-render/docs/exec-brief',
    tags: ['Documents', 'CDN', 'Mobile'],
  },
  {
    title: 'Customer communication platform',
    description:
      'One notification path for every product system: a front door with ingestion, outbox and release, a core brain, and one adapter each for email, SMS, push and physical mail.',
    to: '/docs/customer-communication-platform/docs/exec-brief',
    tags: ['Front door', 'Core brain', 'Adapters'],
  },
];

function TopicCard({title, description, to, tags}: Topic) {
  return (
    <Link to={to} className={styles.card}>
      <Heading as="h2" className={styles.cardTitle}>
        {title}
      </Heading>
      <p className={styles.cardText}>{description}</p>
      <ul className={styles.tags}>
        {tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
    </Link>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <header className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>Solution architecture</p>
          <Heading as="h1" className={styles.title}>
            {siteConfig.title}
          </Heading>
          <p className={styles.subtitle}>{siteConfig.tagline}</p>
        </div>
      </header>
      <main className="container margin-bottom--xl">
        <div className={styles.grid}>
          {topics.map((topic) => (
            <TopicCard key={topic.to} {...topic} />
          ))}
        </div>
      </main>
    </Layout>
  );
}
