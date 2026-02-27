import { Resource, Field } from "../lib/decorators";
import { jsonFile } from "../lib/stores";

@Resource("/api/todos", jsonFile(import.meta.dir + "/todos.json"), { notify: "todos" })
export class Todo {
  @Field({ required: true }) accessor title: string = "";
  @Field() accessor status: string = "pending"; // pending | active | done
  @Field() accessor tags: string[] = [];
  @Field({ readonly: true }) accessor createdAt: string = "";

  id: string = "";
}
