import sharp from "sharp";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

interface ProcessOptions {
  userDir: string;
  filename: string;
  generateThumbnail?: boolean;
  generateMedium?: boolean;
}

interface ProcessResult {
  width: number;
  height: number;
  originalPath: string;
  thumbnailPath?: string;
  mediumPath?: string;
  metadata: PhotoMetadata;
}

interface PhotoMetadata {
  camera?: string;
  lens?: string;
  iso?: number;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
}

export async function processImage(
  buffer: Buffer,
  options: ProcessOptions
): Promise<ProcessResult> {
  const rawImage = sharp(buffer);
  const metadata = await rawImage.metadata();

  // Extract EXIF data before rotation
  const exif = metadata.exif ? parseExif(metadata) : {};

  // Auto-rotate based on EXIF orientation, then get corrected dimensions
  const rotatedBuffer = await sharp(buffer).rotate().toBuffer();
  const image = sharp(rotatedBuffer);
  const rotatedMeta = await image.metadata();
  const width = rotatedMeta.width ?? 0;
  const height = rotatedMeta.height ?? 0;

  // Save the auto-rotated original (orientation baked into pixels)
  await mkdir(join(options.userDir, "original"), { recursive: true });
  const originalPath = join(options.userDir, "original", options.filename);
  await writeFile(originalPath, rotatedBuffer);

  const result: ProcessResult = {
    width,
    height,
    originalPath: join("original", options.filename),
    metadata: exif,
  };

  // Generate thumbnail (300px)
  if (options.generateThumbnail) {
    const thumbnailBuffer = await image
      .resize(300, 300, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnailFilename = options.filename.replace(
      /\.[^.]+$/,
      "_thumb.jpg"
    );
    const thumbnailPath = join(
      options.userDir,
      "thumbnails",
      thumbnailFilename
    );
    await writeFile(thumbnailPath, thumbnailBuffer);
    result.thumbnailPath = join("thumbnails", thumbnailFilename);
  }

  // Generate medium size (1200px)
  if (options.generateMedium) {
    const mediumBuffer = await image
      .resize(1200, 1200, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    const mediumFilename = options.filename.replace(/\.[^.]+$/, "_medium.jpg");
    const mediumPath = join(options.userDir, "medium", mediumFilename);
    await writeFile(mediumPath, mediumBuffer);
    result.mediumPath = join("medium", mediumFilename);
  }

  return result;
}

function parseExif(metadata: sharp.Metadata): PhotoMetadata {
  const result: PhotoMetadata = {};

  // Sharp provides limited EXIF data in metadata
  // For full EXIF parsing, you'd use a library like exif-parser

  if (metadata.density) {
    // Basic info available
  }

  return result;
}

export async function generateImageVariants(
  buffer: Buffer,
  sizes: Array<{ name: string; width: number; height?: number }>
): Promise<Map<string, Buffer>> {
  const results = new Map<string, Buffer>();
  const image = sharp(buffer).rotate();

  for (const size of sizes) {
    const resized = await image
      .resize(size.width, size.height, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    results.set(size.name, resized);
  }

  return results;
}

export async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

export async function convertToWebP(
  buffer: Buffer,
  quality = 80
): Promise<Buffer> {
  return sharp(buffer).webp({ quality }).toBuffer();
}
