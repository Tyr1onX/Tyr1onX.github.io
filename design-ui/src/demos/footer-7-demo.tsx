import { Footer7 } from "../../components/navigation/footer-7";

const logo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='178' height='28' viewBox='0 0 178 28'%3E%3Crect width='28' height='28' rx='7' fill='%23171717'/%3E%3Cpath d='M8 14h12M14 8v12' stroke='white' stroke-width='2'/%3E%3Ctext x='36' y='19' font-family='Arial,sans-serif' font-size='14' font-weight='700' fill='%23171717'%3EShadcnblocks%3C/text%3E%3C/svg%3E";

export function Footer7Demo() {
  return <Footer7 logo={{ url: "#", src: logo, alt: "Shadcnblocks", title: "Shadcnblocks.com" }} />;
}
