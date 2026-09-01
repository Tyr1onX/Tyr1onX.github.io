import { Footer7 } from "../../components/navigation/footer-7";

const logo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='28' viewBox='0 0 96 28'%3E%3Crect width='28' height='28' rx='7' fill='%23171717'/%3E%3Cpath d='M8 14h12M14 8v12' stroke='white' stroke-width='2'/%3E%3Ctext x='36' y='19' font-family='Arial,sans-serif' font-size='14' font-weight='700' fill='%23171717'%3EUI%3C/text%3E%3C/svg%3E";

export function Footer7Demo() {
  return <Footer7 className="py-4" logo={{ url: "#", src: logo, alt: "UI", title: "UI Library" }} description="Small, useful interface references for future products." sections={[
    { title: "Library", links: [{ name: "Components", href: "#" }, { name: "Patterns", href: "#" }] },
    { title: "Project", links: [{ name: "Notes", href: "#" }, { name: "Changelog", href: "#" }] },
    { title: "About", links: [{ name: "Source", href: "#" }, { name: "Credits", href: "#" }] },
  ]} copyright="© UI Library" legalLinks={[{ name: "License", href: "#" }, { name: "Attribution", href: "#" }]} />;
}
