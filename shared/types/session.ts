export interface SessionVisit {
  username: string;
  joinTime: number;
  leaveTime: number | null;
}

export interface SessionRecord {
  sessionId: string;
  spaceId: string;
  startTime: number;
  endTime: number | null;
  visits: SessionVisit[];
}

export interface GetHistoryEvent {
  spaceId: string;
}

export interface HistoryEvent {
  spaceId: string;
  sessions: SessionRecord[];
}
