import React from 'react';
import Layout from '@theme/Layout';
import clsx from 'clsx';
import styles from './index.module.css';

export default function Home() {
    return (
        <Layout
            title="Cloud & DevOps Blog"
            description="Insights on Azure, Terraform, DevOps & Infrastructure as Code">
            <header className={clsx('hero hero--primary', styles.heroBanner)}>
                <div className="container">
                    <h1 className="hero__title">Chris O'Malley</h1>
                    <p className="hero__subtitle">My thoughts on Cloud, DevOps, IaC and other random topics</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                        <a className="button button--secondary button--lg" href="/blog">Read the Blog</a>
                        <a className="button button--secondary button--lg" href="https://github.com/thecomalley">GitHub</a>
                        <a className="button button--secondary button--lg" href="https://www.linkedin.com/in/thecomalley/">LinkedIn</a>
                    </div>
                </div>
            </header>
            <main>
                <section className={styles.certificates}>
                    <div className="container">
                        <h2 className="text--center margin-bottom--xl">Certifications</h2>
                        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
                            <div className="col col--4">
                                <a href="https://learn.microsoft.com/api/credentials/share/en-us/comalley/BC5F174592E5B0A4?sharingId=AC480DD143EEB4E4">
                                    <div className="card">
                                        <div className="card__body">
                                            <h3>Azure DevOps Engineer Expert</h3>
                                            <img
                                                src="https://images.credly.com/size/340x340/images/c3ab66f8-5d59-4afa-a6c2-0ba30a1989ca/CERT-Expert-DevOps-Engineer-600x600.png"
                                                alt="Azure DevOps Engineer"
                                                style={{ width: '200px' }}
                                            />
                                        </div>
                                    </div>
                                </a>
                            </div>
                            <div className="col col--4">
                                <a href="https://developer.hashicorp.com/terraform/certification">
                                    <div className="card">
                                        <div className="card__body">
                                            <h3>HashiCorp Certified: Terraform Associate</h3>
                                            <img
                                                src="https://images.credly.com/size/340x340/images/99289602-861e-4929-8277-773e63a2fa6f/image.png"
                                                alt="Terraform Associate"
                                                style={{ width: '200px' }}
                                            />
                                        </div>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </Layout>
    );
}