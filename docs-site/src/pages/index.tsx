import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/getting-started">
            Get Started
          </Link>
          <Link className="button button--primary button--lg" to="https://github.com/pulsewatch/pulsewatch">
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`PulseWatch - ${siteConfig.tagline}`}
      description="Developer-first uptime monitoring for websites, APIs, SSL certificates, and heartbeat jobs.">
      <HomepageHeader />
      <main>
        <div className="container container--narrow">
          <div className="row margin-top--lg">
            <div className="col">
              <Heading as="h2">Why PulseWatch?</Heading>
              <p>
                PulseWatch continuously monitors your services and immediately detects outages, slow response times,
                SSL certificate issues, and unexpected failures.
              </p>
              <p>
                Instead of simply telling you that something is down, PulseWatch analyzes incidents and provides
                meaningful explanations to help you identify potential causes faster.
              </p>
              <p>
                Whether you're managing a personal portfolio, a startup API, or production infrastructure,
                PulseWatch keeps you informed before your users notice a problem.
              </p>
            </div>
          </div>
          <div className="row margin-top--lg">
            <div className="col">
              <Heading as="h2">Core Features</Heading>
              <ul>
                <li>🌐 Website Monitoring</li>
                <li>⚙️ API Monitoring</li>
                <li>🔒 SSL Certificate Tracking</li>
                <li>❤️ Heartbeat Monitoring</li>
                <li>📊 Response Time Analytics</li>
                <li>🤖 AI Incident Diagnosis</li>
                <li>📢 Telegram Notifications</li>
                <li>📧 Email Alerts</li>
                <li>🌍 Public Status Pages</li>
                <li>📜 Incident History</li>
              </ul>
            </div>
          </div>
          <div className="row margin-top--lg">
            <div className="col">
              <Heading as="h2">Open Source</Heading>
              <p>
                PulseWatch is an open-source monitoring platform built with modern technologies including React,
                FastAPI, PostgreSQL, Tailwind CSS, and Neon.
              </p>
              <p>Contributions, feature requests, and bug reports are always welcome.</p>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}