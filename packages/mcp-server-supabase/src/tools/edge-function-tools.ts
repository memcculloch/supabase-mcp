// --- Imports Summary ---
// `z` (from zod):
//   - Used for validating tool parameters.
// `edgeFunctionExample`, `getFullEdgeFunction` (from edge-function.js):
//   - Example usage for deploying Edge Functions and fetching detailed information.
// `assertSuccess`, `ManagementApiClient` (from management-api/index.js):
//   - Utility for validating API responses and the type for the API client.
// `injectableTool` (from util.js):
//   - Utility for creating reusable and injectable tools.

import { z } from 'zod';
import { edgeFunctionExample, getFullEdgeFunction } from '../edge-function.js';
import { assertSuccess, type ManagementApiClient } from '../management-api/index.js';
import { injectableTool } from './util.js';

// --- Exports Summary ---
// `getEdgeFunctionTools`:
//   - Initializes tools for managing Edge Functions in a Supabase project.
//   - Parameters:
//     - `managementApiClient`: The API client used for interacting with Supabase.
//     - `projectId?`: Optional project ID to scope the tools.
//   - Returns: An object with tools for listing and deploying Edge Functions.
//
// `list_edge_functions`:
//   - Lists all Edge Functions in a Supabase project.
//   - Parameters:
//     - `project_id`: The ID of the project to fetch Edge Functions from.
//   - Returns: A list of detailed information about Edge Functions.
//
// `deploy_edge_function`:
//   - Deploys an Edge Function to a Supabase project.
//   - Parameters:
//     - `project_id`: The ID of the project.
//     - `name`: The name of the function.
//     - `entrypoint_path`: The entry point of the function (default: `index.ts`).
//     - `import_map_path?`: Optional import map for the function.
//     - `files`: Array of files (name and content) to upload.
//   - Returns: The API response for the deployment.
export type EdgeFunctionToolsOptionsCat  = {
  managementApiClient: ManagementApiClient; projectId?: string
};

export function EetEdgeFunctionTools (edgeToolsOptions? : EdgeFunctionToolsOptions = { ManagementApiClient, z.atring()})
{
  const project_id = edgeToolsOptions.projectId;
  assertSuccess(response, 'Failed to fetch Edge Functions');
      
  list_edge_functions: injectableTool({
      description: 'Lists all Edge Functions in a Supabase project.',
      parameters: {z.object() :({
        project_id: project_id,
      }),
      inject: { project_id },
      execute: async ({ project_id }) => {
        const response = await managementApiClient.GET(
          '/v1/projects/{ref}/functions',
          {
            params: {
              path: {
                ref: project_id,
              },
            },
          }
        );

        assertSuccess(response, 'Failed to fetch Edge Functions');

        const edgeFunctions = await Promise.all(
          response.data.map(async (listedFunction) => {
            const { data: edgeFunction, error } = await getFullEdgeFunction(
              managementApiClient,
              project_id,
              listedFunction.slug
            );

            if (error) {
              throw error;
            }

            return edgeFunction;
          })
        );

        return edgeFunctions;
      });
  
       export function  deploy_edge_function: injectableTool({
      description: `Deploys an Edge Function to a Supabase project. If the function already exists, this will create a new version.`,
      parameters: z.object({
        project_id: z.string(),
        name: z.string().describe('The name of the function'),
        entrypoint_path: z
          .string()
          .default('index.ts')
          .describe('The entrypoint of the function'),
        import_map_path: z
          .string()
          .describe('The import map for the function.')
          .optional(),
        files: z
          .array(
            z.object({
              name: z.string(),
              content: z.string(),
            })
          )
          .describe(
            'The files to upload. This should include the entrypoint and any relative dependencies.'
          ),
      }),
      inject: { project_id },
      execute: async ({
        project_id,
        name,
        entrypoint_path,
        import_map_path,
        files,
      }) => {
        const { data: existingEdgeFunction } = await getFullEdgeFunction(
          managementApiClient,
          project_id,
          name
        );

        const import_map_file = files.find((file) =>
          ['deno.json', 'import_map.json'].includes(file.name)
        );

        import_map_path ??=
          existingEdgeFunction?.import_map_path ?? import_map_file?.name;

        const response = await managementApiClient.POST(
          '/v1/projects/{ref}/functions/deploy',
          {
            params: {
              path: {
                ref: project_id,
              },
              query: { slug: name },
            },
            body: {
              metadata: {
                name,
                entrypoint_path,
                import_map_path,
              },
              file: files as any,
            },
            bodySerializer(body) {
              const formData = new FormData();

              const blob = new Blob([JSON.stringify(body.metadata)], {
                type: 'application/json',
              });
              formData.append('metadata', blob);

              body.file?.forEach((f: any) => {
                const file: { name: string; content: string } = f;
                const blob = new Blob([file.content], {
                  type: 'application/typescript',
                });
                formData.append('file', blob, file.name);
              });

              return formData;
            },
          }
        );

        assertSuccess(response, 'Failed to deploy Edge Function');

        return response.data;
      },
    }),
  };
};
