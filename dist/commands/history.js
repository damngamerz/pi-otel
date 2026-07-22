export function registerHistoryCommand(pi, evaluateLatest) {
    pi.registerCommand("otel-eval-history", {
        description: "Evaluate the latest N exchanges (1-20, default 5)",
        handler: async (args, ctx) => {
            const n = args?.[0] ? parseInt(args[0], 10) : 5;
            if (Number.isNaN(n) || n < 1 || n > 20) {
                ctx.ui.notify("Usage: /otel-eval-history [1-20]", "warning");
                return;
            }
            ctx.ui.notify("");
            for (let i = 0; i < n; i++) {
                await evaluateLatest(ctx, false);
            }
            ctx.ui.notify(`Batch evaluation: processed up to ${n} exchanges.`, "info");
        },
    });
}
//# sourceMappingURL=history.js.map