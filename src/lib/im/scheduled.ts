import { runTodoReminders } from "./todo-reminders";
import { retryPendingUserStates } from "./state-outbox";

export function scheduleImMinuteTasks(env: CloudflareEnv, ctx: ExecutionContext): void {
	ctx.waitUntil(runTodoReminders(env));
	ctx.waitUntil(retryPendingUserStates(env));
}
