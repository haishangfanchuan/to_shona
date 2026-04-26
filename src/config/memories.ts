export interface MemoryConfig {
    id: string;
    triggerX: number;
    text: string;
}

export const MEMORIES: MemoryConfig[] = [
    {
        id: "glasses_store",
        triggerX: 665,
        text: "故事的起点，藏着最初的心动。"
    },
    {
        id: "snack_shop",
        triggerX: 986,
        text: "没有买到的零食...小小的遗憾，却是最珍贵的回忆。"
    }
];
