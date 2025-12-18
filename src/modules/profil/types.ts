import type { SearchEntity } from '@/modules/search/schema';
import type React from "react";
import type { Project, Event, Poi } from "@communecter/cocolight-api-client";

export type ProfileEntity = SearchEntity;

export interface EntityAction {
  id: string;
  type: "follow" | "unfollow" | "friend" | "unfriend" | "join" | "leave" | "pending" | "accept" | "reject";
  label: string;
  icon: React.ReactNode;
  variant: "default" | "outline" | "destructive";
  onClick: () => void;
  requiresConfirmation: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  confirmationConfirm?: string;
  confirmationCancel?: string;
  isDestructive?: boolean;
  isPending?: boolean;
  disabled?: boolean;
  show: boolean;
}

export interface EntityActionsResult {
  actions: EntityAction[];
  layout: "separate-buttons" | "status-dropdown";
  statusLabel?: string;
  statusIcon?: React.ReactNode;
  statusVariant?: "default" | "outline";
}

export interface UserAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant: "default" | "outline" | "destructive" | "secondary";
  onClick: () => void;
  disabled?: boolean;
  requiresConfirmation?: boolean;
}

export type RelationType = "projects" | "events" | "poi";

export interface RelatedEntitiesParams {
  indexStep?: number;
  search?: string;
}

export interface UseRelatedEntitiesResult {
  entities: (Project | Event | Poi)[];
  totalCount: number;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  lastItemRef: (node: HTMLElement | null) => void;
  error: Error | null;
  refetch: () => void;
}

export interface MemberQueryOptions {
  toBeValidated?: boolean;
  isAdmin?: boolean;
  isAdminPending?: boolean;
  isInviting?: boolean;
  roles?: unknown[];
}

export interface MemberQueryParams {
  indexStep?: number;
  search?: string;
}

export interface FriendsQueryParams {
  indexStep?: number;
  search?: string;
  status?: "all" | "pending" | "friends" | "sent";
}

export interface ConfirmationState {
  open: boolean;
  title: string;
  description: string;
  action: () => void;
  isDestructive?: boolean;
}
