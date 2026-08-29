export interface Question {
  id: string;
  number: number;
  question: string;
  answer: string;
  bookletPage: number;
  questionSourceStatus: string;
  questionApprovalStatus: string;
  scripture: {
    reference: string;
    text: string;
    verificationStatus: string;
    referenceReviewStatus: string;
    theologicalReviewStatus: string;
    authorizedSource: string;
    note: string;
  };
  teaching: {
    status: string;
    meaning: string;
    connection: string;
    whyItMatters: string;
  };
}
export interface Variation {
  id: string;
  title: string;
  instruction: string;
  mode: "normal" | "hidden" | "split" | "echo";
}
export interface Stage {
  kind: string;
  eyebrow: string;
  title: string;
  question?: Question;
  variation?: Variation;
  answerVisible?: boolean;
  scriptureText?: string;
  scripturePage?: number;
  scripturePages?: number;
}

export type RecitationPhase =
  | "hidden"
  | "revealing"
  | "ready"
  | "countdown"
  | "reciting"
  | "paused"
  | "complete";
