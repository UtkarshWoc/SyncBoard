import { z } from 'zod';
import { BOARD_ID_PATTERN, LIMITS } from './constants.js';

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const boardIdSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().regex(BOARD_ID_PATTERN, 'Invalid board code'));

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const passwordSchema = z
  .string()
  .min(LIMITS.PASSWORD_MIN, `Password must be at least ${LIMITS.PASSWORD_MIN} characters`)
  .max(LIMITS.PASSWORD_MAX);
export const displayNameSchema = trimmed(LIMITS.DISPLAY_NAME_MAX);

export const generalAccessSchema = z.enum(['restricted', 'viewer', 'editor']);
export const memberRoleSchema = z.enum(['editor', 'viewer']);
export const backgroundSchema = z.enum(['plain', 'grid']);

// ─── Auth ──────────────────────────────────────────────────────
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(LIMITS.PASSWORD_MAX),
});
export const googleAuthSchema = z.object({ credential: z.string().min(10).max(4096) });
export const tokenSchema = z.object({ token: z.string().min(16).max(256) });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: z.string().min(16).max(256),
  password: passwordSchema,
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().max(LIMITS.PASSWORD_MAX).optional(),
  newPassword: passwordSchema,
});
export const updateProfileSchema = z.object({ displayName: displayNameSchema });

// ─── Boards ────────────────────────────────────────────────────
export const createBoardSchema = z.object({
  name: trimmed(LIMITS.BOARD_NAME_MAX),
  listed: z.boolean().default(false),
  generalAccess: generalAccessSchema.default('restricted'),
  background: backgroundSchema.default('plain'),
});
export const updateBoardSchema = z
  .object({
    name: trimmed(LIMITS.BOARD_NAME_MAX),
    listed: z.boolean(),
    generalAccess: generalAccessSchema,
    background: backgroundSchema,
    /** `null` removes the password. */
    password: z.string().min(4).max(LIMITS.BOARD_PASSWORD_MAX).nullable(),
  })
  .partial();
export const updateMemberSchema = z.object({ role: memberRoleSchema });
export const createInviteSchema = z.object({
  role: memberRoleSchema,
  expiresInDays: z.number().int().min(1).max(90).nullable().default(null),
});
export const thumbnailSchema = z.object({
  dataURL: z
    .string()
    .max(Math.ceil(LIMITS.THUMBNAIL_BYTES_MAX * 1.4))
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Thumbnail must be a PNG, JPEG or WebP data URL'),
});
export const uploadFileSchema = z.object({
  id: z.string().min(1).max(128),
  mimeType: z.string().regex(/^image\/(png|jpeg|gif|webp|svg\+xml|bmp|x-icon|avif)$/),
  dataURL: z
    .string()
    .max(Math.ceil(LIMITS.FILE_BYTES_MAX * 1.4))
    .regex(/^data:[\w/+.-]+;base64,/, 'Expected a base64 data URL'),
});
export const createVersionSchema = z.object({
  label: z.string().trim().max(LIMITS.VERSION_LABEL_MAX).optional(),
  thumbnail: thumbnailSchema.shape.dataURL.optional(),
});

// ─── Socket payloads ───────────────────────────────────────────
export const sceneElementSchema = z
  .object({
    id: z.string().min(1).max(128),
    version: z.number().int().nonnegative(),
    versionNonce: z.number().int(),
    isDeleted: z.boolean().optional(),
    type: z.string().max(64),
  })
  .loose();

export const joinBoardSchema = z.object({
  boardId: boardIdSchema,
  password: z.string().max(LIMITS.BOARD_PASSWORD_MAX).optional(),
});
export const sceneUpdateSchema = z.object({
  elements: z.array(sceneElementSchema).min(1).max(LIMITS.ELEMENTS_PER_UPDATE),
});

const finite = z.number().finite();
export const presenceSchema = z.object({
  pointer: z
    .object({ x: finite, y: finite, tool: z.enum(['pointer', 'laser']) })
    .nullable()
    .optional(),
  button: z.enum(['up', 'down']).optional(),
  selectedElementIds: z
    .record(z.string().max(128), z.literal(true))
    .refine((o) => Object.keys(o).length <= 1000, 'Too many selected elements')
    .optional(),
  viewport: z
    .object({
      scrollX: finite,
      scrollY: finite,
      zoom: z.number().min(0.01).max(100),
      width: z.number().min(0).max(20000),
      height: z.number().min(0).max(20000),
    })
    .optional(),
});

export const chatSendSchema = z.object({ text: trimmed(LIMITS.CHAT_MESSAGE_MAX) });
export const chatHistorySchema = z.object({ before: z.string().max(64).optional() });
export const chatDeleteSchema = z.object({ messageId: z.string().min(1).max(64) });
export const chatMuteSchema = z.object({ userId: z.string().min(1).max(64), muted: z.boolean() });

export const commentCreateSchema = z.object({ x: finite, y: finite, text: trimmed(LIMITS.COMMENT_MAX) });
export const commentReplySchema = z.object({
  threadId: z.string().min(1).max(64),
  text: trimmed(LIMITS.COMMENT_MAX),
});
export const commentResolveSchema = z.object({ threadId: z.string().min(1).max(64), resolved: z.boolean() });
export const commentDeleteSchema = z.object({ threadId: z.string().min(1).max(64) });

export const rtcSignalSchema = z.object({
  to: z.string().min(1).max(64),
  data: z.union([
    z.object({
      description: z.object({
        type: z.enum(['offer', 'answer', 'pranswer', 'rollback']),
        sdp: z.string().max(100_000).optional(),
      }),
    }),
    z.object({
      candidate: z
        .object({
          candidate: z.string().max(2000),
          sdpMid: z.string().max(64).nullable().optional(),
          sdpMLineIndex: z.number().int().nullable().optional(),
          usernameFragment: z.string().max(256).nullable().optional(),
        })
        .nullable(),
    }),
  ]),
});
export const rtcMediaSchema = z.object({ audio: z.boolean(), video: z.boolean() });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateBoardInput = z.input<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type CreateInviteInput = z.input<typeof createInviteSchema>;
export type JoinBoardInput = z.infer<typeof joinBoardSchema>;
export type RtcSignal = z.infer<typeof rtcSignalSchema>;
export type RtcSignalData = RtcSignal['data'];
export type RtcMediaState = z.infer<typeof rtcMediaSchema>;
