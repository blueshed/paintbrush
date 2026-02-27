import { Resource, Field } from "../lib/decorators";
import { jsonFile } from "../lib/stores";

@Resource("/api/notes", jsonFile(import.meta.dir + "/notes.json"))
export class Note {
  @Field({ required: true }) accessor title: string = "";
  @Field() accessor body: string = "";
  @Field({ readonly: true }) accessor createdAt: string = "";

  id: string = "";
}
