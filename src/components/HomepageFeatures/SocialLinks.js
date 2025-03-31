import React from 'react';
import { FaGithub, FaTwitter, FaLinkedin } from 'react-icons/fa';

export default function SocialLinks() {
    return (
        <div className="social-links">
            <a href="https://github.com/your-username" target="_blank" rel="noopener noreferrer">
                <FaGithub size={24} />
            </a>
            <a href="https://linkedin.com/in/your-profile" target="_blank" rel="noopener noreferrer">
                <FaLinkedin size={24} />
            </a>

            <style jsx>{`
        .social-links {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .social-links a {
          color: var(--ifm-navbar-link-color);
          transition: color 0.2s;
        }
        .social-links a:hover {
          color: var(--ifm-navbar-link-hover-color);
        }
      `}</style>
        </div>
    );
}