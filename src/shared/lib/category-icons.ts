import {
  Tag, Package, ShoppingBag, ShoppingCart, Gift, Receipt, Ticket, Store,
  Home, Sofa, Bed, Lamp, Bath, Armchair, DoorOpen, BookOpen,
  Laptop, Smartphone, Tablet, Headphones, Watch, Camera, Monitor,
  Keyboard, Mouse, Gamepad2, Cpu, Cable, HardDrive, Printer, Router, Tv,
  Shirt, Glasses, Gem, Crown, Footprints, Sparkles,
  Coffee, Pizza, IceCream, Wine, Beer, CakeSlice, Utensils, Apple,
  Sandwich, Carrot, Egg, Fish as FishIcon, Beef,
  Dumbbell, Bike, Medal, Trophy, Tent,
  Flower, Flower2, Heart, Palette, Brush, Scissors, Droplet,
  Baby, Book, Rocket, Puzzle, ToyBrick,
  Briefcase, Pen, FileText, Newspaper, Calculator,
  Car, Bus, Plane, Ship, Fuel, Train,
  Wrench, Hammer, Drill, PaintBucket, HardHat,
  Leaf, TreePine, Sprout,
  Dog, Cat, Bird, Rabbit, PawPrint,
  Music, Film, Disc, Mic, Guitar,
  Stethoscope, Pill, Syringe, HeartPulse, BriefcaseMedical,
  Flame, Zap, Sun, Moon, Cloud,
  type LucideIcon,
} from 'lucide-react';

type IconGroup = {
  label: string;
  icons: { name: string; component: LucideIcon }[];
};

export const CATEGORY_ICON_GROUPS: IconGroup[] = [
  {
    label: 'Tienda y Compras',
    icons: [
      { name: 'Tag', component: Tag },
      { name: 'Package', component: Package },
      { name: 'ShoppingBag', component: ShoppingBag },
      { name: 'ShoppingCart', component: ShoppingCart },
      { name: 'Gift', component: Gift },
      { name: 'Receipt', component: Receipt },
      { name: 'Ticket', component: Ticket },
      { name: 'Store', component: Store },
    ],
  },
  {
    label: 'Hogar',
    icons: [
      { name: 'Home', component: Home },
      { name: 'Sofa', component: Sofa },
      { name: 'Bed', component: Bed },
      { name: 'Lamp', component: Lamp },
      { name: 'Bath', component: Bath },
      { name: 'Armchair', component: Armchair },
      { name: 'DoorOpen', component: DoorOpen },
      { name: 'BookOpen', component: BookOpen },
    ],
  },
  {
    label: 'Tecnología',
    icons: [
      { name: 'Laptop', component: Laptop },
      { name: 'Smartphone', component: Smartphone },
      { name: 'Tablet', component: Tablet },
      { name: 'Headphones', component: Headphones },
      { name: 'Watch', component: Watch },
      { name: 'Camera', component: Camera },
      { name: 'Monitor', component: Monitor },
      { name: 'Keyboard', component: Keyboard },
      { name: 'Mouse', component: Mouse },
      { name: 'Gamepad2', component: Gamepad2 },
      { name: 'Cpu', component: Cpu },
      { name: 'Cable', component: Cable },
      { name: 'HardDrive', component: HardDrive },
      { name: 'Printer', component: Printer },
      { name: 'Router', component: Router },
      { name: 'Tv', component: Tv },
    ],
  },
  {
    label: 'Moda y Accesorios',
    icons: [
      { name: 'Shirt', component: Shirt },
      { name: 'Glasses', component: Glasses },
      { name: 'Gem', component: Gem },
      { name: 'Crown', component: Crown },
      { name: 'Footprints', component: Footprints },
      { name: 'Sparkles', component: Sparkles },
    ],
  },
  {
    label: 'Comida y Bebida',
    icons: [
      { name: 'Coffee', component: Coffee },
      { name: 'Pizza', component: Pizza },
      { name: 'IceCream', component: IceCream },
      { name: 'Wine', component: Wine },
      { name: 'Beer', component: Beer },
      { name: 'CakeSlice', component: CakeSlice },
      { name: 'Utensils', component: Utensils },
      { name: 'Apple', component: Apple },
      { name: 'Sandwich', component: Sandwich },
      { name: 'Carrot', component: Carrot },
      { name: 'Egg', component: Egg },
      { name: 'Fish', component: FishIcon },
      { name: 'Beef', component: Beef },
    ],
  },
  {
    label: 'Deportes y Aire Libre',
    icons: [
      { name: 'Dumbbell', component: Dumbbell },
      { name: 'Bike', component: Bike },
      { name: 'Medal', component: Medal },
      { name: 'Trophy', component: Trophy },
      { name: 'Tent', component: Tent },
    ],
  },
  {
    label: 'Belleza y Bienestar',
    icons: [
      { name: 'Flower', component: Flower },
      { name: 'Flower2', component: Flower2 },
      { name: 'Heart', component: Heart },
      { name: 'Palette', component: Palette },
      { name: 'Brush', component: Brush },
      { name: 'Scissors', component: Scissors },
      { name: 'Droplet', component: Droplet },
    ],
  },
  {
    label: 'Niños y Juguetes',
    icons: [
      { name: 'Baby', component: Baby },
      { name: 'Book', component: Book },
      { name: 'Rocket', component: Rocket },
      { name: 'Puzzle', component: Puzzle },
      { name: 'ToyBrick', component: ToyBrick },
    ],
  },
  {
    label: 'Oficina y Papelería',
    icons: [
      { name: 'Briefcase', component: Briefcase },
      { name: 'Pen', component: Pen },
      { name: 'FileText', component: FileText },
      { name: 'Newspaper', component: Newspaper },
      { name: 'Calculator', component: Calculator },
    ],
  },
  {
    label: 'Vehículos',
    icons: [
      { name: 'Car', component: Car },
      { name: 'Bus', component: Bus },
      { name: 'Plane', component: Plane },
      { name: 'Ship', component: Ship },
      { name: 'Fuel', component: Fuel },
      { name: 'Train', component: Train },
    ],
  },
  {
    label: 'Herramientas',
    icons: [
      { name: 'Wrench', component: Wrench },
      { name: 'Hammer', component: Hammer },
      { name: 'Drill', component: Drill },
      { name: 'PaintBucket', component: PaintBucket },
      { name: 'HardHat', component: HardHat },
    ],
  },
  {
    label: 'Naturaleza',
    icons: [
      { name: 'Leaf', component: Leaf },
      { name: 'TreePine', component: TreePine },
      { name: 'Sprout', component: Sprout },
    ],
  },
  {
    label: 'Mascotas',
    icons: [
      { name: 'Dog', component: Dog },
      { name: 'Cat', component: Cat },
      { name: 'Bird', component: Bird },
      { name: 'Rabbit', component: Rabbit },
      { name: 'PawPrint', component: PawPrint },
    ],
  },
  {
    label: 'Entretenimiento',
    icons: [
      { name: 'Music', component: Music },
      { name: 'Film', component: Film },
      { name: 'Disc', component: Disc },
      { name: 'Mic', component: Mic },
      { name: 'Guitar', component: Guitar },
    ],
  },
  {
    label: 'Salud',
    icons: [
      { name: 'Stethoscope', component: Stethoscope },
      { name: 'Pill', component: Pill },
      { name: 'Syringe', component: Syringe },
      { name: 'HeartPulse', component: HeartPulse },
      { name: 'BriefcaseMedical', component: BriefcaseMedical },
    ],
  },
  {
    label: 'Otros',
    icons: [
      { name: 'Flame', component: Flame },
      { name: 'Zap', component: Zap },
      { name: 'Sun', component: Sun },
      { name: 'Moon', component: Moon },
      { name: 'Cloud', component: Cloud },
    ],
  },
];

const iconMap: Record<string, LucideIcon> = CATEGORY_ICON_GROUPS
  .flatMap((g) => g.icons)
  .reduce((acc, i) => ({ ...acc, [i.name]: i.component }), {});

export const DEFAULT_CATEGORY_ICON: LucideIcon = Tag;

export function getCategoryIcon(name?: string | null): LucideIcon {
  if (!name) return DEFAULT_CATEGORY_ICON;
  return iconMap[name] ?? DEFAULT_CATEGORY_ICON;
}

export function isValidIconName(name: string): boolean {
  return name in iconMap;
}
