import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
};

export function PageHeader({ eyebrow, title, description, icon: Icon, badge }: PageHeaderProps) {
  return (
    <motion.div
      className="mb-5 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="min-w-0">
        <div className="mb-3 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.24em] text-nexus-cyan sm:tracking-[0.28em]">
          <Icon className="size-4 shrink-0" />
          {eyebrow}
        </div>
        <h1 className="break-words text-2xl font-semibold tracking-normal text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      </div>
      {badge ? <Badge>{badge}</Badge> : null}
    </motion.div>
  );
}
