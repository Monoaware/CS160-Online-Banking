"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTable } from "./users-table";
import { TransactionsTable } from "./transactions-table";

export default function ManagerPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="space-y-4">
          <UsersTable />
        </TabsContent>
        <TabsContent value="transactions" className="space-y-4">
          <TransactionsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
