// Shared shapes used by the browser, the routes and the Sarvam layer.

export type LanguageCode =
  | "hi-IN"
  | "en-IN"
  | "bn-IN"
  | "gu-IN"
  | "kn-IN"
  | "mr-IN"
  | "pa-IN"
  | "ta-IN"
  | "te-IN";

export type Level = "school" | "college" | "expert";

export type LessonStatus = "reading" | "planning" | "ready" | "failed";

export interface Topic {
  id: string;
  title: string;
  summary: string;
  done: boolean;
  quizCorrect: boolean | null;
}

export interface Lesson {
  id: string;
  title: string;
  filename: string;
  level: Level;
  language: LanguageCode;
  status: LessonStatus;
  error?: string;
  createdAt: string;
  topics: Topic[];
}

export interface DiagramNode {
  id: string;
  label: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export type BoardItemKind = "heading" | "text" | "bullet" | "equation" | "diagram";

export interface BoardItem {
  kind: BoardItemKind;
  text?: string;
  latex?: string;
  nodes?: DiagramNode[];
  edges?: DiagramEdge[];
}

export interface Step {
  say: string;
  clearBoard: boolean;
  board: BoardItem[];
}

export interface Quiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface TopicScript {
  topicId: string;
  steps: Step[];
  quiz: Quiz;
}

export interface DoubtAnswer {
  question: string;
  heardLanguage: string;
  steps: Step[];
}
