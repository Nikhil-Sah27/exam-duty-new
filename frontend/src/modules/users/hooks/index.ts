
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  importUsers,
  FetchUsersOptions,
} from "../services";
import { CreateUserRequest, ImportUsersRequest, UpdateUserRequest } from "../types";

const USERS_KEY = ["users"];
const usersKey = (options: FetchUsersOptions = {}) => [
  ...USERS_KEY,
  { includeInactive: !!options.includeInactive },
];

export const useUsers = (options: FetchUsersOptions = {}) => {
  return useQuery({
    queryKey: usersKey(options),
    queryFn: () => fetchUsers(options),
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserRequest) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      // Teacher CRUD shifts the eligible-teacher pool → recompute duty targets.
      queryClient.invalidateQueries({ queryKey: ["duty-calculation"] });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      // Teacher CRUD shifts the eligible-teacher pool → recompute duty targets.
      queryClient.invalidateQueries({ queryKey: ["duty-calculation"] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      // Teacher CRUD shifts the eligible-teacher pool → recompute duty targets.
      queryClient.invalidateQueries({ queryKey: ["duty-calculation"] });
    },
  });
};

export const useActivateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => activateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      queryClient.invalidateQueries({ queryKey: ["duty-calculation"] });
    },
  });
};

/** CSV import. A real (non-dry) run refreshes the teacher list and duty targets. */
export const useImportUsers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ImportUsersRequest) => importUsers(data),
    onSuccess: (result) => {
      if (result.dryRun || result.summary.created === 0) return;
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      queryClient.invalidateQueries({ queryKey: ["duty-calculation"] });
    },
  });
};
