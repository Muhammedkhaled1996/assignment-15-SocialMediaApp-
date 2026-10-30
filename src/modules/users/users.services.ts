import { NotFoundException } from "../../common/exception/domain.exception.js";
import { IUser } from "../../common/interface/user.interface.js";
import { UserRepository } from "../../common/repository/user.repository.js";

export class UserService {
  private userRepository: UserRepository;
  constructor() {
    this.userRepository = new UserRepository();
  }

  Profile(user: IUser) {
    return user;
  }

  async update(user: IUser & { id?: string  }, { userName }: { userName: string }) {
    const existingUser = await this.userRepository.findById({ id: user.id  as string});

    if (!existingUser) {
      throw new NotFoundException("user not found");
    }

    existingUser.userName = userName;
    await existingUser.save();

    return existingUser;
  }
}

export default new UserService();
