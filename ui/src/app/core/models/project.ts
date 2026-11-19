/** Mirrors the API's project/media shapes (api/src/modules/projects/project.service.ts). */

export type MediaKind = 'image' | 'video';

export interface MediaItem {
  kind: MediaKind;
  url: string;
  alt?: string;
  poster?: string;
  width?: number;
  height?: number;
  mediaId?: string;
}

export interface MediaBlock {
  id?: string;
  type: 'media';
  /** full = one item across the width; split = two items side by side */
  layout: 'full' | 'split';
  items: MediaItem[];
  caption?: string;
}

export interface TextBlock {
  id?: string;
  type: 'text';
  heading?: string;
  body: string;
}

export type Block = MediaBlock | TextBlock;

export interface Hero {
  image: string;
  video: string;
  poster: string;
}

export interface Seo {
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
}

/** Everything the case-study layout needs. Shared by the public page and the admin preview. */
export interface ProjectView {
  title: string;
  hero: Hero;
  mainTitle: string;
  subtitle: string;
  client: string;
  involvement: string[];
  result: string;
  blocks: Block[];
}

export interface ProjectCard {
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
}

export interface FeaturedTile {
  slug: string;
  title: string;
  image: string;
  hasDetails: boolean;
}

export interface Neighbour {
  slug: string;
  title: string;
  heroImage: string;
  thumbnail: string;
}

export interface PublicProject extends ProjectView, ProjectCard {
  seo: Seo;
  publishedAt: string | null;
  updatedAt: string;
  prev: Neighbour | null;
  next: Neighbour | null;
}

export type ProjectStatus = 'draft' | 'published';

export interface AdminProject extends ProjectView {
  id: string;
  version: number;
  slug: string;
  description: string;
  thumbnail: string;
  status: ProjectStatus;
  listed: boolean;
  order: number;
  featured: boolean;
  featuredOrder: number;
  featuredImage: string;
  featuredLabel: string;
  seo: Seo;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AdminProjectInput = Omit<
  AdminProject,
  'id' | 'version' | 'order' | 'featuredOrder' | 'publishedAt' | 'createdAt' | 'updatedAt'
>;

export interface AdminProjectListItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  status: ProjectStatus;
  listed: boolean;
  order: number;
  featured: boolean;
  featuredOrder: number;
  featuredImage: string;
  featuredLabel: string;
  blockCount: number;
  updatedAt: string;
  publishedAt: string | null;
}

export interface MediaAsset {
  id: string;
  key: string;
  url: string;
  kind: MediaKind;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  alt: string;
  originalName: string;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** Site-wide editable content (api/src/modules/settings). */
export interface HomeHero {
  image: string;
  /** Optional portrait crop shown on phones */
  mobileImage: string;
  /** Optional: plays instead of the image when set */
  video: string;
  poster: string;
  alt: string;
  /** "Works" button position, % from the top of the hero */
  buttonTopDesktop: number;
  buttonTopMobile: number;
}

export interface SiteSettings {
  homeHero: HomeHero;
  updatedAt: string | null;
}

export interface ApiErrorBody {
  error: { message: string; code?: string; details?: unknown };
}
