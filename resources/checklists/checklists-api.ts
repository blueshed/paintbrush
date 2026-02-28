import { Resource, Field } from "../../lib/decorators";
import { sqliteStore } from "../../lib/sqlite-store";

@Resource("/api/checklists", sqliteStore("checklists"), { notify: "checklists" })
export class Checklist {
  @Field({ required: true }) accessor title: string = "";
  @Field() accessor checked: boolean = false;
  @Field({ readonly: true }) accessor createdAt: string = "";

  id: string = "";
}
