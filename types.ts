export interface Room {
  id: string;
  hostId: string | null;
  participants: Set<string>;
  connections: Map<string, string>;
} 