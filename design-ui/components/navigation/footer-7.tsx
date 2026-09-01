import type { ReactNode } from "react";
import { FaFacebook, FaGithub, FaInstagram, FaLinkedin, FaTwitter } from "react-icons/fa";
import { cn } from "../_utils/cn";

export interface FooterLink { name: string; href: string }
export interface FooterSection { title: string; links: FooterLink[] }
export interface FooterSocialLink { icon: ReactNode; href: string; label: string }
export interface FooterLogo { url: string; src: string; alt: string; title: string }

export interface Footer7Props {
  logo?: FooterLogo;
  description?: string;
  sections?: FooterSection[];
  socialLinks?: FooterSocialLink[];
  copyright?: string;
  legalLinks?: FooterLink[];
  className?: string;
}

const defaultProps: Required<Omit<Footer7Props, "className">> = {
  logo: {
    url: "https://www.shadcnblocks.com",
    src: "/images/logo/shadcnblocks-logo-word.svg",
    alt: "logo",
    title: "Shadcnblocks.com",
  },
  description: "Finely crafted blocks built with Shadcn UI.",
  sections: [
    { title: "Product", links: [{ name: "Overview", href: "#" }, { name: "Pricing", href: "#" }, { name: "Marketplace", href: "#" }, { name: "Features", href: "#" }, { name: "Integrations", href: "#" }] },
    { title: "Company", links: [{ name: "About", href: "#" }, { name: "Team", href: "#" }, { name: "Blog", href: "#" }, { name: "Careers", href: "#" }, { name: "Contact", href: "#" }] },
    { title: "Support", links: [{ name: "Help center", href: "#" }, { name: "Documentation", href: "#" }, { name: "Status", href: "#" }, { name: "Community", href: "#" }] },
    { title: "Resources", links: [{ name: "Guides", href: "#" }, { name: "Templates", href: "#" }, { name: "Sales", href: "#" }, { name: "Advertise", href: "#" }] },
  ],
  socialLinks: [
    { icon: <FaInstagram className="size-5" />, href: "#", label: "Instagram" },
    { icon: <FaFacebook className="size-5" />, href: "#", label: "Facebook" },
    { icon: <FaTwitter className="size-5" />, href: "#", label: "Twitter" },
    { icon: <FaLinkedin className="size-5" />, href: "#", label: "LinkedIn" },
    { icon: <FaGithub className="size-5" />, href: "#", label: "GitHub" },
  ],
  copyright: "© 2024 Shadcnblocks.com. All rights reserved.",
  legalLinks: [{ name: "Terms and Conditions", href: "#" }, { name: "Privacy Policy", href: "#" }],
};

export function Footer7(props: Footer7Props) {
  const { logo, sections, description, socialLinks, copyright, legalLinks, className } = { ...defaultProps, ...props };
  return (
    <section className={cn("py-32", className)}>
      <div className="container mx-auto">
        <div className="flex w-full flex-col justify-between gap-10 lg:flex-row lg:items-start lg:text-left">
          <div className="flex w-full flex-col justify-between gap-6 lg:items-start">
            <div className="flex items-center gap-2 lg:justify-start">
              <a href={logo?.url}><img src={logo?.src} alt={logo?.alt} title={logo?.title} className="h-7 dark:invert" /></a>
            </div>
            <p className="max-w-[70%] text-sm text-muted-foreground">{description}</p>
            <ul className="flex items-center space-x-6 text-muted-foreground">
              {socialLinks?.map((social, idx) => <li key={idx} className="font-medium transition-colors hover:text-primary"><a href={social.href} aria-label={social.label}>{social.icon}</a></li>)}
            </ul>
          </div>
          <div className="grid w-full gap-6 md:grid-cols-3 lg:gap-20">
            {sections?.slice(0, 3).map((section, sectionIdx) => (
              <div key={sectionIdx}>
                <h3 className="mb-4 font-semibold tracking-tight">{section.title}</h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {section.links.map((link, linkIdx) => <li key={linkIdx} className="font-medium transition-colors hover:text-primary"><a href={link.href}>{link.name}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col justify-between gap-4 border-t border-border py-8 text-xs font-medium text-muted-foreground md:flex-row md:items-center md:text-left">
          <p className="order-2 lg:order-1">{copyright}</p>
          <ul className="order-1 flex flex-col gap-2 md:order-2 md:flex-row">
            {legalLinks?.map((link, idx) => <li key={idx} className="transition-colors hover:text-primary"><a href={link.href}>{link.name}</a></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
