import { RiCheckboxCircleFill, RiCloseCircleLine, RiShieldCheckLine } from "react-icons/ri";
import { StatusBadge } from "../../components/status/status-badge";

export function StatusBadgeDemo() {
  return <div className="flex min-h-[300px] flex-wrap items-center justify-center gap-3 p-8"><StatusBadge leftIcon={RiShieldCheckLine} rightIcon={RiCloseCircleLine} leftLabel="Protection" rightLabel="SSO login" status="success" /><StatusBadge leftIcon={RiCheckboxCircleFill} leftLabel="Live" status="success" /><StatusBadge leftIcon={RiCloseCircleLine} leftLabel="Incident" status="error" /></div>;
}
