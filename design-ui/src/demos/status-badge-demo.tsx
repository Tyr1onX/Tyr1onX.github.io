import { RiCheckboxCircleFill, RiCloseCircleFill, RiCloseCircleLine, RiShieldCheckLine } from "react-icons/ri";
import { StatusBadge } from "../../components/status/status-badge";

export function StatusBadgeDemo() {
  return (
    <div className="flex min-h-[260px] flex-wrap items-center justify-center gap-4 p-8">
      <StatusBadge leftIcon={RiShieldCheckLine} rightIcon={RiCloseCircleLine} leftLabel="Protection" rightLabel="SSO login" status="success" />
      <StatusBadge leftIcon={RiCheckboxCircleFill} rightIcon={RiCloseCircleLine} leftLabel="Live" rightLabel="Audit trails" status="success" />
      <StatusBadge leftIcon={RiCloseCircleFill} rightIcon={RiShieldCheckLine} leftLabel="Safety checks" rightLabel="Production" status="error" />
    </div>
  );
}
