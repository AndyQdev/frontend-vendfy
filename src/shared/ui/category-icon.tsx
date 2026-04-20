import { cn } from '@/shared/lib/cn';
import { getCategoryIcon } from '@/shared/lib/category-icons';

interface CategoryIconProps {
  name?: string | null;
  className?: string;
  size?: number;
}

export function CategoryIcon({ name, className, size = 20 }: CategoryIconProps) {
  const Icon = getCategoryIcon(name);
  return <Icon className={cn('shrink-0', className)} size={size} />;
}
