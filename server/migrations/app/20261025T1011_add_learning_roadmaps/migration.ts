#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/12ea62d85fb6cb13bc29d975918d43f4a8b15e8f7c377579ae28a3064ae16da1/contract';
import startContract from '../../snapshots/12ea62d85fb6cb13bc29d975918d43f4a8b15e8f7c377579ae28a3064ae16da1/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/76b63865cfe2c1a9a7877c302353bfc2dc0ae22b32161ffc928cb5e3f5b8492e/contract';
import endContract from '../../snapshots/76b63865cfe2c1a9a7877c302353bfc2dc0ae22b32161ffc928cb5e3f5b8492e/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'learning_roadmap',
        columns: [
          col('analysis', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('content', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('durationMonths', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('generationError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('limitations', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('phase', 'text', {
            notNull: true,
            default: lit('analyzing'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('sourceIds', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('generating'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'learning_roadmap_sourceIds_elem_not_null_07253a8e',
            'array_position("sourceIds", NULL) IS NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'roadmap_activity',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('resourceId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('roadmapId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('taskId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'roadmap_task_progress',
        columns: [
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isCompleted', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('roadmapId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('taskId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'roadmap_task_progress',
        constraint: 'roadmap_task_progress_roadmapId_taskId_key',
        columns: ['roadmapId', 'taskId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'learning_roadmap',
        index: 'learning_roadmap_workspaceId_createdAt_idx_5ff7e893',
        columns: ['workspaceId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'learning_roadmap',
        index: 'learning_roadmap_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'learning_roadmap',
        index: 'learning_roadmap_workspaceId_status_idx_76d68132',
        columns: ['workspaceId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'roadmap_activity',
        index: 'roadmap_activity_roadmapId_createdAt_idx_ee1c3de0',
        columns: ['roadmapId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'roadmap_activity',
        index: 'roadmap_activity_roadmapId_idx_be7128ae',
        columns: ['roadmapId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'roadmap_task_progress',
        index: 'roadmap_task_progress_roadmapId_idx_be7128ae',
        columns: ['roadmapId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'learning_roadmap',
        foreignKey: {
          name: 'learning_roadmap_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'workspace', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'roadmap_activity',
        foreignKey: {
          name: 'roadmap_activity_roadmapId_fkey',
          columns: ['roadmapId'],
          references: { schema: 'public', table: 'learning_roadmap', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'roadmap_task_progress',
        foreignKey: {
          name: 'roadmap_task_progress_roadmapId_fkey',
          columns: ['roadmapId'],
          references: { schema: 'public', table: 'learning_roadmap', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
