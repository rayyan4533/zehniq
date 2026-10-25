#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/76b63865cfe2c1a9a7877c302353bfc2dc0ae22b32161ffc928cb5e3f5b8492e/contract';
import startContract from '../../snapshots/76b63865cfe2c1a9a7877c302353bfc2dc0ae22b32161ffc928cb5e3f5b8492e/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f4979764c963546a04b08b4c003a0df7d1ef39926e1d64f9f81a45040cb98549/contract';
import endContract from '../../snapshots/f4979764c963546a04b08b4c003a0df7d1ef39926e1d64f9f81a45040cb98549/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'roadmap_collection',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'learning_roadmap',
        column: col('collectionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'learning_roadmap',
        column: col('topicGoals', 'text[]', {
          notNull: true,
          default: lit([]),
          codecRef: { codecId: 'pg/text@1', many: true },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'source',
        column: col('collectionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'learning_roadmap', column: 'workspaceId' }),
      this.dropNotNull({ schema: 'public', table: 'source', column: 'workspaceId' }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'learning_roadmap',
        constraint: 'learning_roadmap_topicGoals_elem_not_null_473e5449',
        expression: 'array_position("topicGoals", NULL) IS NULL',
      }),
      this.createIndex({
        schema: 'public',
        table: 'learning_roadmap',
        index: 'learning_roadmap_collectionId_createdAt_idx_8cc402d6',
        columns: ['collectionId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'learning_roadmap',
        index: 'learning_roadmap_collectionId_idx_b344fc1a',
        columns: ['collectionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'roadmap_collection',
        index: 'roadmap_collection_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'roadmap_collection',
        index: 'roadmap_collection_userId_updatedAt_idx_42f5280d',
        columns: ['userId', 'updatedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'source',
        index: 'source_collectionId_idx_b344fc1a',
        columns: ['collectionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'source',
        index: 'source_collectionId_status_idx_11b1d1f5',
        columns: ['collectionId', 'status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'roadmap_collection',
        foreignKey: {
          name: 'roadmap_collection_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'learning_roadmap',
        foreignKey: {
          name: 'learning_roadmap_collectionId_fkey',
          columns: ['collectionId'],
          references: { schema: 'public', table: 'roadmap_collection', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'source',
        foreignKey: {
          name: 'source_collectionId_fkey',
          columns: ['collectionId'],
          references: { schema: 'public', table: 'roadmap_collection', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
