import { DatabaseRepository } from "./base.repository";
import { CommentModel } from "../../DB/module";
import { IComment } from "../interface";

export class CommentRepository extends DatabaseRepository<IComment> {
  constructor() {
    super(CommentModel);
  }
}
