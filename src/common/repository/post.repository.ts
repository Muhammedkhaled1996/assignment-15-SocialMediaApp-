import { DatabaseRepository } from "./base.repository";
import { PostModel } from "../../DB/module";
import { IPost } from "../interface";

export class PostRepository extends DatabaseRepository<IPost> {
  constructor() {
    super(PostModel);
  }
}
