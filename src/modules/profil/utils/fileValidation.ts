/**
 * Utilitaires de validation de fichiers pour les uploads
 */

export interface FileValidationConfig {
  maxSizeInMB: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  errorKey?: string;
}

/**
 * Valide un fichier selon les critères donnés
 */
export function validateFile(
  file: File,
  config: FileValidationConfig
): FileValidationResult {
  // Validation de la taille
  const maxSizeInBytes = config.maxSizeInMB * 1024 * 1024;
  if (file.size > maxSizeInBytes) {
    return {
      valid: false,
      error: `File size exceeds ${config.maxSizeInMB}MB`,
      errorKey: "upload.errors.fileTooLarge",
    };
  }

  // Validation du type MIME
  if (config.allowedTypes && config.allowedTypes.length > 0) {
    const typeMatches = config.allowedTypes.some((type) => {
      if (type.endsWith("/*")) {
        return file.type.startsWith(type.replace("/*", "/"));
      }
      return file.type === type;
    });

    if (!typeMatches) {
      return {
        valid: false,
        error: `File type not allowed: ${file.type}`,
        errorKey: "upload.errors.invalidFileType",
      };
    }
  }

  // Validation de l'extension
  if (config.allowedExtensions && config.allowedExtensions.length > 0) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !config.allowedExtensions.includes(`.${extension}`)) {
      return {
        valid: false,
        error: `File extension not allowed: ${extension}`,
        errorKey: "upload.errors.invalidExtension",
      };
    }
  }

  return { valid: true };
}

/**
 * Valide plusieurs fichiers
 */
export function validateFiles(
  files: File[],
  config: FileValidationConfig
): { validFiles: File[]; errors: string[] } {
  const validFiles: File[] = [];
  const errors: string[] = [];

  files.forEach((file) => {
    const result = validateFile(file, config);
    if (result.valid) {
      validFiles.push(file);
    } else if (result.error) {
      errors.push(`${file.name}: ${result.error}`);
    }
  });

  return { validFiles, errors };
}

/**
 * Formate une taille de fichier en string lisible
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Configuration par défaut pour les images
 */
export const IMAGE_VALIDATION_CONFIG: FileValidationConfig = {
  maxSizeInMB: 10,
  allowedTypes: ["image/*"],
};

/**
 * Configuration par défaut pour les documents
 */
export const DOCUMENT_VALIDATION_CONFIG: FileValidationConfig = {
  maxSizeInMB: 20,
  allowedExtensions: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".odt", ".ods"],
};
