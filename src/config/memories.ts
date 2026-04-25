export interface MemoryConfig {
    id: string;
    triggerX: number;
    text: string;
}

export const MEMORIES: MemoryConfig[] = [
    {
        id: "glasses_store",
        triggerX: 665,
        text: "这是我们相遇的地方。人生若只如初见，可是..."
    },
    {
        id: "snack_shop",
        triggerX: 986,
        text: "那一次你并没有买到你爱吃的零食..."
    }
];
