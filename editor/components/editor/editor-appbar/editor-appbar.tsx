import React from "react";
import styled from "@emotion/styled";
import { AppbarFragmentForSidebar } from "./editor-appbar-fragment-for-sidebar";
import { AppbarFragmentForCanvas } from "./editor-appbar-fragment-for-canvas";
import { AppbarFragmentForCodeEditor } from "./editor-appbar-fragment-for-code-editor";

export function Appbar() {
  return (
    <AppbarContainer>
      <AppbarFragmentForSidebar></AppbarFragmentForSidebar>
      <AppbarFragmentForCanvas></AppbarFragmentForCanvas>
      <AppbarFragmentForCodeEditor></AppbarFragmentForCodeEditor>
    </AppbarContainer>
  );
}

const AppbarContainer = styled.div`
  display: flex;
  justify-content: flex-start;
  flex-direction: row;
  align-items: start;
  flex: 1;
  gap: 0;
  align-self: stretch;
  box-sizing: border-box;
`;
