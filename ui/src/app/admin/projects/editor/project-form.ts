import { FormArray, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import {
  AdminProject,
  AdminProjectInput,
  Block,
  MediaItem,
  MediaKind,
  ProjectStatus,
  ProjectView,
} from '../../../core/models/project';

const text = (v = '', ...validators: ValidatorFn[]) => new FormControl(v, { nonNullable: true, validators });

export type MediaItemForm = FormGroup<{
  kind: FormControl<MediaKind>;
  url: FormControl<string>;
  alt: FormControl<string>;
  poster: FormControl<string>;
  width: FormControl<number | null>;
  height: FormControl<number | null>;
  mediaId: FormControl<string | null>;
}>;

export type BlockForm = FormGroup<{
  id: FormControl<string | null>;
  type: FormControl<'media' | 'text'>;
  layout: FormControl<'full' | 'split'>;
  items: FormArray<MediaItemForm>;
  caption: FormControl<string>;
  heading: FormControl<string>;
  body: FormControl<string>;
}>;

export function mediaItemForm(item: Partial<MediaItem> = {}): MediaItemForm {
  return new FormGroup({
    kind: new FormControl<MediaKind>(item.kind ?? 'image', { nonNullable: true }),
    url: text(item.url ?? '', Validators.required, Validators.maxLength(2048)),
    alt: text(item.alt ?? '', Validators.maxLength(300)),
    poster: text(item.poster ?? '', Validators.maxLength(2048)),
    width: new FormControl<number | null>(item.width ?? null),
    height: new FormControl<number | null>(item.height ?? null),
    mediaId: new FormControl<string | null>(item.mediaId ?? null),
  });
}

export function blockForm(block?: Block): BlockForm {
  const isText = block?.type === 'text';
  const items = !block || isText ? [] : block.items.map((i) => mediaItemForm(i));
  const form: BlockForm = new FormGroup({
    id: new FormControl<string | null>(block?.id ?? null),
    type: new FormControl<'media' | 'text'>(block?.type ?? 'media', { nonNullable: true }),
    layout: new FormControl<'full' | 'split'>(isText || !block ? 'full' : block.layout, { nonNullable: true }),
    items: new FormArray<MediaItemForm>(items),
    caption: text(!isText && block ? (block.caption ?? '') : '', Validators.maxLength(500)),
    heading: text(isText ? (block.heading ?? '') : '', Validators.maxLength(300)),
    body: text(isText ? block.body : '', ...(isText ? [Validators.required] : []), Validators.maxLength(20000)),
  });
  return form;
}

/** Block presets offered in the "Add block" menu. */
export type BlockPreset = 'image' | 'video' | 'two-images' | 'two-videos' | 'image-video' | 'text';

export function presetBlock(preset: BlockPreset): BlockForm {
  switch (preset) {
    case 'text':
      return blockForm({ type: 'text', heading: '', body: '' });
    case 'image':
    case 'video':
      return blockForm({ type: 'media', layout: 'full', items: [{ kind: preset, url: '' }] });
    case 'two-images':
      return blockForm({ type: 'media', layout: 'split', items: [{ kind: 'image', url: '' }, { kind: 'image', url: '' }] });
    case 'two-videos':
      return blockForm({ type: 'media', layout: 'split', items: [{ kind: 'video', url: '' }, { kind: 'video', url: '' }] });
    case 'image-video':
      return blockForm({ type: 'media', layout: 'split', items: [{ kind: 'image', url: '' }, { kind: 'video', url: '' }] });
  }
}

/** Deep copy of a block (new identity, so the server assigns a new id). */
export function cloneBlock(src: BlockForm): BlockForm {
  const v = src.getRawValue();
  if (v.type === 'text') return blockForm({ type: 'text', heading: v.heading, body: v.body });
  return blockForm({
    type: 'media',
    layout: v.layout,
    caption: v.caption,
    items: v.items.map((i) => ({
      kind: i.kind,
      url: i.url,
      alt: i.alt,
      poster: i.poster,
      width: i.width ?? undefined,
      height: i.height ?? undefined,
      mediaId: i.mediaId ?? undefined,
    })),
  });
}

/** Switching full ↔ split keeps existing media and adds/removes the second slot. */
export function setBlockLayout(block: BlockForm, layout: 'full' | 'split') {
  const items = block.controls.items;
  block.controls.layout.setValue(layout);
  if (layout === 'split' && items.length < 2) {
    items.push(mediaItemForm({ kind: items.at(0)?.controls.kind.value ?? 'image' }));
  } else if (layout === 'full') {
    while (items.length > 1) items.removeAt(items.length - 1);
  }
  block.markAsDirty();
}

export function createProjectForm() {
  return new FormGroup({
    title: text('', Validators.required, Validators.maxLength(200)),
    slug: text('', Validators.maxLength(80), Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
    description: text('', Validators.maxLength(300)),
    thumbnail: text(''),
    hero: new FormGroup({ image: text(''), video: text(''), poster: text('') }),
    mainTitle: text('', Validators.maxLength(300)),
    subtitle: text('', Validators.maxLength(500)),
    client: text('', Validators.maxLength(200)),
    involvement: new FormArray<FormControl<string>>([]),
    result: text('', Validators.maxLength(5000)),
    blocks: new FormArray<BlockForm>([]),
    status: new FormControl<ProjectStatus>('draft', { nonNullable: true }),
    listed: new FormControl(true, { nonNullable: true }),
    featured: new FormControl(false, { nonNullable: true }),
    featuredImage: text(''),
    featuredLabel: text('', Validators.maxLength(200)),
    seo: new FormGroup({
      metaTitle: text('', Validators.maxLength(200)),
      metaDescription: text('', Validators.maxLength(500)),
      ogImage: text(''),
    }),
  });
}

export type ProjectForm = ReturnType<typeof createProjectForm>;

export function involvementControl(v = '') {
  return text(v, Validators.required, Validators.maxLength(100));
}

export function patchProjectForm(form: ProjectForm, p: AdminProject) {
  form.controls.involvement.clear({ emitEvent: false });
  p.involvement.forEach((v) => form.controls.involvement.push(involvementControl(v), { emitEvent: false }));
  form.controls.blocks.clear({ emitEvent: false });
  p.blocks.forEach((b) => form.controls.blocks.push(blockForm(b), { emitEvent: false }));
  form.patchValue({
    title: p.title,
    slug: p.slug,
    description: p.description,
    thumbnail: p.thumbnail,
    hero: p.hero,
    mainTitle: p.mainTitle,
    subtitle: p.subtitle,
    client: p.client,
    result: p.result,
    status: p.status,
    listed: p.listed,
    featured: p.featured,
    featuredImage: p.featuredImage,
    featuredLabel: p.featuredLabel,
    seo: p.seo,
  });
  form.markAsPristine();
  form.markAsUntouched();
}

function cleanItem(i: ReturnType<MediaItemForm['getRawValue']>): MediaItem {
  const out: MediaItem = { kind: i.kind, url: i.url.trim(), alt: i.alt.trim() };
  if (i.kind === 'video' && i.poster.trim()) out.poster = i.poster.trim();
  if (i.width) out.width = i.width;
  if (i.height) out.height = i.height;
  if (i.mediaId) out.mediaId = i.mediaId;
  return out;
}

function toBlocks(raw: ReturnType<ProjectForm['getRawValue']>['blocks']): Block[] {
  return raw.map((b): Block => {
    const id = b.id ?? undefined;
    if (b.type === 'text') return { id, type: 'text', heading: b.heading.trim(), body: b.body.trim() };
    return { id, type: 'media', layout: b.layout, items: b.items.map(cleanItem), caption: b.caption.trim() };
  });
}

export function toInput(form: ProjectForm): AdminProjectInput {
  const v = form.getRawValue();
  return {
    ...v,
    slug: v.slug.trim(),
    involvement: v.involvement.map((s) => s.trim()).filter(Boolean),
    blocks: toBlocks(v.blocks),
  };
}

/** Live preview model: tolerant of incomplete input (empty slots are skipped). */
export function toPreview(v: ReturnType<ProjectForm['getRawValue']>): ProjectView {
  return {
    title: v.title || 'Untitled project',
    hero: v.hero,
    mainTitle: v.mainTitle,
    subtitle: v.subtitle,
    client: v.client,
    involvement: v.involvement.filter((s) => s.trim()),
    result: v.result,
    blocks: toBlocks(v.blocks).filter((b) =>
      b.type === 'text' ? !!b.body : b.items.length > 0 && b.items.every((i) => !!i.url),
    ),
  };
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
