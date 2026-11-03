"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentRepository = void 0;
const base_repository_1 = require("./base.repository");
const module_1 = require("../../DB/module");
class CommentRepository extends base_repository_1.DatabaseRepository {
    constructor() {
        super(module_1.CommentModel);
    }
}
exports.CommentRepository = CommentRepository;
